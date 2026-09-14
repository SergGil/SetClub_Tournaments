"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { homePanelSettingsFormSchema, HOME_PANEL_DOMAIN_LABEL } from "@/lib/validation/home-panels";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

export async function updateHomePanelSettingsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = homePanelSettingsFormSchema.safeParse({
    key: formData.get("key"),
    eyebrow: formData.get("eyebrow"),
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const { key, ...data } = parsed.data;

  // Each domain's own admin edits only their own panel - a COFFEE admin
  // can't touch the Tennis or Padel panel text, even though all three
  // live on the shared homepage. A superadmin passes every check.
  const session = await requireDomainAdmin(key);

  await prisma.homePanelSettings.upsert({
    where: { key },
    create: { key, ...data },
    update: data,
  });

  after(() => logAudit(session.user, {
    action: "home.panel.update",
    entityType: "HomePanelSettings",
    entityId: key,
    summary: `Оновлено текст панелі «${HOME_PANEL_DOMAIN_LABEL[key]}» на головній сторінці`,
  }));

  revalidatePath("/admin/home");
  revalidatePath("/");
  return { success: true };
}
