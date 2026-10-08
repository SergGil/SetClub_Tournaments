"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import type { ActionState } from "@/lib/actions/padel-matches";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
// Sport-agnostic (no Prisma coupling) - reused as-is, same as padel-matches.ts.
import { rubberFormSchema } from "@/lib/validation/rubber";
import { createPadelRubberCore } from "@/lib/actions/padel-ties-core";

/** See the identical helper in ties.ts/matches.ts for the full Base UI Select rationale. */
function nonEmptyFormValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}

/** Padel twin of createTieAction - a Davis-Cup-style tie between two of a tournament's teams. */
export async function createPadelTieAction(
  tournamentId: string,
  teamAId: string,
  teamBId: string,
  label: string = "",
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL", request);

  if (teamAId === teamBId) return { error: "Оберіть дві різні команди" };
  const trimmedLabel = label.trim();
  if (trimmedLabel.length > 100) return { error: "Мітка занадто довга (максимум 100 символів)" };

  const teams = await prisma.padelTournamentTeam.findMany({
    where: { id: { in: [teamAId, teamBId] }, tournamentId },
    select: { id: true },
  });
  if (teams.length !== 2) return { error: "Команду не знайдено — можливо, її вже видалили" };

  const created = await prisma.padelTournamentTie.create({
    data: { tournamentId, teamAId, teamBId, label: trimmedLabel || null },
  });

  after(() =>
    logAudit(session.user, {
      action: "padel.tournament.tie.create",
      entityType: "PadelTournament",
      entityId: tournamentId,
      summary: `Створено зустріч (Падел)${trimmedLabel ? ` «${trimmedLabel}»` : ""} (${created.id})`,
    }),
  );

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  return {};
}

/** Padel twin of deleteTieAction - rubbers survive as ordinary standalone matches (PadelMatch.tieId -> SetNull). */
export async function deletePadelTieAction(
  tournamentId: string,
  tieId: string,
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL", request);

  const tie = await prisma.padelTournamentTie.findUnique({
    where: { id: tieId },
    select: { tournamentId: true, label: true },
  });
  if (!tie || tie.tournamentId !== tournamentId) {
    return { error: "Зустріч не знайдено — можливо, її вже видалили" };
  }

  await prisma.padelTournamentTie.delete({ where: { id: tieId } });

  after(() =>
    logAudit(session.user, {
      action: "padel.tournament.tie.delete",
      entityType: "PadelTournament",
      entityId: tournamentId,
      summary: `Видалено зустріч (Падел)${tie.label ? ` «${tie.label}»` : ""}`,
    }),
  );

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  return {};
}

export async function createPadelRubberAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const parsed = rubberFormSchema.safeParse({
    tieId: formData.get("tieId"),
    matchType: formData.get("matchType"),
    scheduledDate: formData.get("scheduledDate"),
    sideAPlayerIds: nonEmptyFormValues(formData, "sideAPlayerIds"),
    sideBPlayerIds: nonEmptyFormValues(formData, "sideBPlayerIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  return createPadelRubberCore(session, parsed.data);
}
