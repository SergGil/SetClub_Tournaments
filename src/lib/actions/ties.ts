"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import type { ActionState } from "@/lib/actions/matches";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { isForeignKeyError } from "@/lib/prisma-errors";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";
import { rubberFormSchema } from "@/lib/validation/rubber";
import type { RubberFormInput } from "@/lib/validation/rubber";

// Same reasoning as matches.ts's own nonEmptyFormValues (not exported from
// there, duplicated here on purpose - see docs/TOURNAMENT_TEAMS.md's "files
// deliberately untouched" note): a single-value player-slot Select still
// registers a hidden, always-present form input, so an unpicked slot arrives
// as "" rather than a missing entry.
function nonEmptyFormValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}

/** A Davis-Cup-style tie between two of a tournament's teams - see docs/TOURNAMENT_TEAMS.md. */
export async function createTieAction(
  tournamentId: string,
  teamAId: string,
  teamBId: string,
  label: string = "",
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

  if (teamAId === teamBId) return { error: "Оберіть дві різні команди" };
  const trimmedLabel = label.trim();
  if (trimmedLabel.length > 100) return { error: "Мітка занадто довга (максимум 100 символів)" };

  const teams = await prisma.tournamentTeam.findMany({
    where: { id: { in: [teamAId, teamBId] }, tournamentId },
    select: { id: true },
  });
  if (teams.length !== 2) return { error: "Команду не знайдено — можливо, її вже видалили" };

  const created = await prisma.tournamentTie.create({
    data: { tournamentId, teamAId, teamBId, label: trimmedLabel || null },
  });

  after(() =>
    logAudit(session.user, {
      action: "tournament.tie.create",
      entityType: "Tournament",
      entityId: tournamentId,
      summary: `Створено зустріч${trimmedLabel ? ` «${trimmedLabel}»` : ""} (${created.id})`,
    }),
  );

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return {};
}

/**
 * Deletes a tie - its rubbers survive as ordinary standalone matches
 * (Match.tieId -> SetNull, see schema.prisma), they just lose their tie
 * grouping and reappear in the flat match list. Never touches match scores
 * or ratings.
 */
export async function deleteTieAction(
  tournamentId: string,
  tieId: string,
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

  const tie = await prisma.tournamentTie.findUnique({
    where: { id: tieId },
    select: { tournamentId: true, label: true },
  });
  if (!tie || tie.tournamentId !== tournamentId) {
    return { error: "Зустріч не знайдено — можливо, її вже видалили" };
  }

  await prisma.tournamentTie.delete({ where: { id: tieId } });

  after(() =>
    logAudit(session.user, {
      action: "tournament.tie.delete",
      entityType: "Tournament",
      entityId: tournamentId,
      summary: `Видалено зустріч${tie.label ? ` «${tie.label}»` : ""}`,
    }),
  );

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return {};
}

/**
 * Creates one rubber (a normal SINGLES/DOUBLES Match, tagged with tieId) for
 * a tie. Deliberately a separate action from createMatchAction (see
 * docs/TOURNAMENT_TEAMS.md) - the key difference is the roster check below,
 * scoped to the tie's own two teams rather than the whole tournament roster.
 * Editing/scoring/deleting a rubber afterward reuses updateMatchAction/
 * saveScoreAction/deleteMatchAction unmodified, since a rubber is just a
 * Match row like any other.
 */
/** Shared by createRubberAction (web form) and POST /api/v1/ties/[id]/rubbers (mobile) - see docs/MOBILE_API.md. */
export async function createRubberCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  data: RubberFormInput,
): Promise<ActionState> {
  const { tieId, matchType, scheduledDate, sideAPlayerIds, sideBPlayerIds } = data;

  const tie = await prisma.tournamentTie.findUnique({
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
    created = await prisma.match.create({
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
      action: "match.create",
      entityType: "Match",
      entityId: created.id,
      summary: `Створено раббер (${matchType}) у зустрічі ${tieId}`,
    }),
  );

  revalidatePath(`/admin/tournaments/${tie.tournamentId}`);
  revalidatePath(`/tournaments/${tie.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}

export async function createRubberAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

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

  return createRubberCore(session, parsed.data);
}
