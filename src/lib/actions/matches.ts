"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { determineMatchWinner } from "@/lib/match-result";
import { requireAdmin } from "@/lib/permissions";
import { PLACEMENT_ROUNDS } from "@/lib/playoff-rounds";
import {
  isForeignKeyError,
  isRecordNotFoundError,
  isUniqueConstraintError,
  uniqueConstraintTarget,
} from "@/lib/prisma-errors";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";
import { matchFormSchema, scoreFormSchema } from "@/lib/validation/match";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export type ActionState = {
  error?: string;
  success?: boolean;
  notice?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Each of these six rounds decides an exact tournament place, and Set Club
 * scoring (src/lib/rating/placement.ts) assumes exactly one match per round
 * per tournament - two matches both labeled "Фінал" would pay two players
 * for 1st place while nobody gets the place their playoff should have
 * decided. Bracket-feeder rounds ("1/8"/"1/4"/"1/2") are exempt: a real
 * bracket plays several of those concurrently by design.
 */
async function findDuplicatePlacementRoundError(
  tournamentId: string,
  round: string | null,
  excludeMatchId?: string,
): Promise<string | null> {
  if (!round || !(PLACEMENT_ROUNDS as readonly string[]).includes(round)) return null;
  const duplicate = await prisma.match.findFirst({
    where: {
      tournamentId,
      round,
      ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
    },
    select: { id: true },
  });
  return duplicate ? `У цьому турнірі вже є матч з раундом «${round}»` : null;
}

export async function createMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const parsed = matchFormSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    matchType: formData.get("matchType"),
    round: formData.get("round"),
    scheduledDate: formData.get("scheduledDate"),
    sideAPlayerIds: formData.getAll("sideAPlayerIds"),
    sideBPlayerIds: formData.getAll("sideBPlayerIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  const { tournamentId, matchType, round, scheduledDate, sideAPlayerIds, sideBPlayerIds } =
    parsed.data;

  // sideAPlayerIds/sideBPlayerIds only get shape-checked by matchFormSchema
  // (non-empty strings, no cross-side dupes) - confirm every id is actually
  // a registered participant of this tournament before writing anything, the
  // same check the doubles/singles randomizers already do.
  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { playerId: true },
  });
  const rosterIds = new Set(participants.map((p) => p.playerId));
  const allPlayerIds = [...sideAPlayerIds, ...sideBPlayerIds];
  if (!allPlayerIds.every((id) => rosterIds.has(id))) {
    return { error: "Гравець не зареєстрований у цьому турнірі" };
  }

  const duplicateRoundError = await findDuplicatePlacementRoundError(tournamentId, round);
  if (duplicateRoundError) {
    return { error: duplicateRoundError };
  }

  let created;
  try {
    created = await prisma.match.create({
      data: {
        tournamentId,
        matchType,
        round,
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
      return { error: "Турнір або гравець не знайдено — можливо, їх вже видалили" };
    }
    // Belt and suspenders alongside findDuplicatePlacementRoundError above:
    // a concurrent create for the same round could otherwise slip past that
    // pre-check and hit the DB's partial unique index instead.
    if (isUniqueConstraintError(error) && uniqueConstraintTarget(error)?.includes("round")) {
      return { error: `У цьому турнірі вже є матч з раундом «${round}»` };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "match.create",
    entityType: "Match",
    entityId: created.id,
    summary: `Створено матч (${matchType}) у турнірі ${tournamentId}`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}

export async function updateMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Матч не знайдено" };
  }

  const parsed = matchFormSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    matchType: formData.get("matchType"),
    round: formData.get("round"),
    scheduledDate: formData.get("scheduledDate"),
    sideAPlayerIds: formData.getAll("sideAPlayerIds"),
    sideBPlayerIds: formData.getAll("sideBPlayerIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  const { matchType, round, scheduledDate, sideAPlayerIds, sideBPlayerIds } = parsed.data;

  // The match's own tournamentId is authoritative here (see the revalidation
  // comment below) - also needed to scope the duplicate-round check to the
  // right tournament, regardless of whatever tournamentId the client sent.
  const currentMatch = await prisma.match.findUnique({
    where: { id: matchId },
    select: { tournamentId: true },
  });
  if (!currentMatch) {
    return { error: "Матч не знайдено — можливо, його вже видалили" };
  }

  const duplicateRoundError = await findDuplicatePlacementRoundError(
    currentMatch.tournamentId,
    round,
    matchId,
  );
  if (duplicateRoundError) {
    return { error: duplicateRoundError };
  }

  // A recorded score (sets, winner, COMPLETED status) refers to a specific
  // pair of sides. If who's playing changes, that score no longer means
  // anything for the new lineup, so wipe it rather than leave it stale.
  const currentPlayers = await prisma.matchPlayer.findMany({
    where: { matchId },
    select: { side: true, playerId: true },
  });
  const currentKey = currentPlayers
    .map((p) => `${p.side}:${p.playerId}`)
    .sort()
    .join(",");
  const newKey = [
    ...sideAPlayerIds.map((id) => `A:${id}`),
    ...sideBPlayerIds.map((id) => `B:${id}`),
  ]
    .sort()
    .join(",");
  const playersChanged = currentKey !== newKey;

  let updatedMatch;
  try {
    [updatedMatch] = await prisma.$transaction([
      prisma.match.update({
        where: { id: matchId },
        data: {
          matchType,
          round,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          ...(playersChanged
            ? { status: "SCHEDULED" as const, winnerSide: null, retired: false, completedAt: null }
            : {}),
        },
      }),
      prisma.matchPlayer.deleteMany({ where: { matchId } }),
      prisma.matchPlayer.createMany({
        data: [
          ...sideAPlayerIds.map((playerId) => ({ matchId, side: "A" as const, playerId })),
          ...sideBPlayerIds.map((playerId) => ({ matchId, side: "B" as const, playerId })),
        ],
      }),
      ...(playersChanged ? [prisma.matchSet.deleteMany({ where: { matchId } })] : []),
    ]);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Матч не знайдено — можливо, його вже видалили" };
    }
    if (isUniqueConstraintError(error)) {
      const target = uniqueConstraintTarget(error) ?? [];
      // Belt and suspenders alongside findDuplicatePlacementRoundError
      // above: a concurrent edit landing on the same round could otherwise
      // slip past that pre-check and hit the DB's partial unique index
      // instead. Only label it as a round conflict when the constraint
      // actually says so - this transaction's matchPlayer.createMany can
      // also hit MatchPlayer's own [matchId, side, playerId] unique
      // constraint (a roster race), which is a different problem entirely.
      if (target.includes("round")) {
        return { error: `У цьому турнірі вже є матч з раундом «${round}»` };
      }
      return {
        error: "Дані матчу змінилися одночасно в іншому місці — оновіть сторінку і спробуйте ще раз",
      };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "match.update",
    entityType: "Match",
    entityId: matchId,
    summary: playersChanged ? "Оновлено матч (склад гравців змінено)" : "Оновлено матч",
  }));

  // Revalidate the match's real tournament, not whatever tournamentId the client sent.
  revalidatePath(`/admin/tournaments/${updatedMatch.tournamentId}`);
  revalidatePath(`/tournaments/${updatedMatch.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return {
    success: true,
    ...(playersChanged
      ? { notice: "Склад гравців змінився — рахунок матчу скинуто." }
      : {}),
  };
}

export async function deleteMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Матч не знайдено" };
  }

  let deleted;
  try {
    deleted = await prisma.match.delete({ where: { id: matchId } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Матч не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "match.delete",
    entityType: "Match",
    entityId: matchId,
    summary: `Видалено матч у турнірі ${deleted.tournamentId}`,
  }));

  revalidatePath(`/admin/tournaments/${deleted.tournamentId}`);
  revalidatePath(`/tournaments/${deleted.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}

/**
 * Thrown from inside saveScoreAction's transaction to force a rollback when
 * the atomic updateMany below finds the row already changed - a plain
 * early-return wouldn't undo the matchSet writes that already ran in the
 * same transaction.
 */
class StaleScoreConflictError extends Error {}

export async function saveScoreAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  let rawSets: unknown;
  try {
    rawSets = JSON.parse(String(formData.get("setsJson") ?? "[]"));
  } catch {
    return { error: "Некоректний рахунок" };
  }

  const parsed = scoreFormSchema.safeParse({
    matchId: formData.get("matchId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    retired: formData.get("retired") === "true",
    retiredWinnerSide: formData.get("retiredWinnerSide") || null,
    sets: rawSets,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректний рахунок",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  // A retirement's winner is whoever didn't retire - picked explicitly by
  // the admin, since the game count alone can't say who was actually ahead
  // when the match was conceded. Otherwise, derive it from the sets as usual.
  const winnerSide = parsed.data.retired
    ? parsed.data.retiredWinnerSide
    : determineMatchWinner(parsed.data.sets);
  if (!parsed.data.retired && parsed.data.sets.length > 0 && !winnerSide) {
    return { error: "Неможливо визначити переможця — рахунок сетів рівний" };
  }

  const existingMatch = await prisma.match.findUnique({
    where: { id: parsed.data.matchId },
    select: { completedAt: true, updatedAt: true, tournamentId: true },
  });
  if (!existingMatch) {
    return { error: "Матч не знайдено — можливо, його вже видалили" };
  }
  // The form was opened against a specific version of this match - if
  // someone else (another admin tab, or the same admin in a second tab)
  // saved a change since then, reject rather than silently overwrite it.
  // This is a fast-path check only - the transaction below re-checks the
  // same condition atomically against the WHERE clause, since a concurrent
  // write could otherwise land in the gap between this check and the write.
  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
  if (
    Number.isNaN(expectedUpdatedAt.getTime()) ||
    expectedUpdatedAt.getTime() !== existingMatch.updatedAt.getTime()
  ) {
    return {
      error: "Матч змінили в іншому місці, поки форма була відкрита. Оновіть сторінку і спробуйте ще раз.",
    };
  }
  // Only stamp completedAt the first time a match becomes COMPLETED - a later
  // correction to an already-completed match's score shouldn't make it look
  // like the match just finished.
  const completedAt = winnerSide ? (existingMatch.completedAt ?? new Date()) : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.matchSet.deleteMany({ where: { matchId: parsed.data.matchId } });
      await tx.matchSet.createMany({
        data: parsed.data.sets.map((set, index) => ({
          matchId: parsed.data.matchId,
          setNumber: index + 1,
          sideAGames: set.sideAGames,
          sideBGames: set.sideBGames,
          tiebreakSideAPoints: set.tiebreakSideAPoints ?? null,
          tiebreakSideBPoints: set.tiebreakSideBPoints ?? null,
        })),
      });
      // updateMany (not update) so the WHERE clause can include updatedAt -
      // this is the atomic version of the fast-path check above: if another
      // save landed between that check and here, updatedAt no longer
      // matches, count comes back 0, and everything in this transaction
      // (including the matchSet writes just above) rolls back together.
      const result = await tx.match.updateMany({
        where: { id: parsed.data.matchId, updatedAt: expectedUpdatedAt },
        data: {
          status: winnerSide ? "COMPLETED" : "SCHEDULED",
          winnerSide,
          retired: parsed.data.retired,
          completedAt,
        },
      });
      if (result.count === 0) {
        throw new StaleScoreConflictError();
      }
    });
  } catch (error) {
    if (error instanceof StaleScoreConflictError) {
      return {
        error: "Матч змінили в іншому місці, поки форма була відкрита. Оновіть сторінку і спробуйте ще раз.",
      };
    }
    if (isRecordNotFoundError(error)) {
      return { error: "Матч не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "match.score",
    entityType: "Match",
    entityId: parsed.data.matchId,
    summary: parsed.data.retired
      ? "Збережено рахунок матчу (завершено зняттям гравця)"
      : "Збережено рахунок матчу",
  }));

  revalidatePath(`/admin/tournaments/${existingMatch.tournamentId}`);
  revalidatePath(`/tournaments/${existingMatch.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}
