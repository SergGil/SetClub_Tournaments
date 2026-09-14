"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { COFFEE_PAGE_SETTINGS_ID } from "@/lib/queries/coffee-settings";
import { coffeePageSettingsFormSchema } from "@/lib/validation/coffee-settings";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

export async function updateCoffeePageSettingsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("COFFEE");

  const parsed = coffeePageSettingsFormSchema.safeParse({
    heroTitle: formData.get("heroTitle"),
    heroSubtitle: formData.get("heroSubtitle"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  await prisma.coffeePageSettings.upsert({
    where: { id: COFFEE_PAGE_SETTINGS_ID },
    create: { id: COFFEE_PAGE_SETTINGS_ID, ...parsed.data },
    update: parsed.data,
  });

  after(() => logAudit(session.user, {
    action: "coffee.settings.update",
    entityType: "CoffeePageSettings",
    entityId: COFFEE_PAGE_SETTINGS_ID,
    summary: `Оновлено заголовок сторінки меню: "${parsed.data.heroTitle}"`,
  }));

  revalidatePath("/admin/menu");
  revalidatePath("/coffee");
  return { success: true };
}
