"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import type { ActionState } from "@/lib/actions/padel-matches";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";
import { requireDomainAdmin } from "@/lib/permissions";
import { isForeignKeyError } from "@/lib/prisma-errors";
import { schedulePadelRatingSnapshotRefresh } from "@/lib/rating/padel-snapshot";
// Sport-agnostic (no Prisma coupling) - reused as-is, same as padel-matches.ts.
import { rubberFormSchema } from "@/lib/validation/rubber";
import type { RubberFormInput } from "@/lib/validation/rubber";

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

/** Padel twin of createRubberAction - creates one rubber (a normal PadelMatch, tagged with tieId) scoped to the tie's own two teams. */
/** Padel twin of createRubberCore. */
export async function createPadelRubberCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  data: RubberFormInput,
): Promise<ActionState> {
  const { tieId, matchType, scheduledDate, sideAPlayerIds, sideBPlayerIds } = data;

  const tie = await prisma.padelTournamentTie.findUnique({
    where: { id: tieId },
    select: {
      tournamentId: true,
      teamA: { select: { members: { select: { playerId: true } } } },
      teamB: { select: { members: { select: { playerId: true } } } },
    },
  });
  if (!tie) return { error: "Зустріч не знайдено — можливо, її вже видалили" };

  const teamAIds = new Set(tie.teamA.members.map((m) => m.playerId));
  const teamBIds = new Set(tie.teamB.members.map((m) => m.playerId));
  if (!sideAPlayerIds.every((id) => teamAIds.has(id))) {
    return { error: "Гравець сторони А має бути учасником команди А цієї зустрічі" };
  }
  if (!sideBPlayerIds.every((id) => teamBIds.has(id))) {
    return { error: "Гравець сторони Б має бути учасником команди Б цієї зустрічі" };
  }

  let created;
  try {
    created = await prisma.padelMatch.create({
      data: {
        tournamentId: tie.tournamentId,
        tieId,
        matchType,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        players: {
          create: [
            ...sideAPlayerIds.map((playerId) => ({ side: "A" as const, playerId })),
            ...sideBPlayerIds.map((playerId) => ({ side: "B" as const, playerId })),
          ],
        },
      },
    });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return { error: "Зустріч або гравець не знайдено — можливо, їх вже видалили" };
    }
    throw error;
  }

  after(() =>
    logAudit(session.user, {
      action: "padel.match.create",
      entityType: "PadelMatch",
      entityId: created.id,
      summary: `Створено раббер (Падел, ${matchType}) у зустрічі ${tieId}`,
    }),
  );

  revalidatePath(`/admin/padel/tournaments/${tie.tournamentId}`);
  revalidatePath(`/padel/tournaments/${tie.tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true };
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
