"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import type { z } from "zod";

import { buildBracketSnapshot, CascadeResetPendingError } from "@/lib/actions/bracket-snapshot";
import type { CascadeReset } from "@/lib/actions/bracket-snapshot";
import { logAudit } from "@/lib/audit";
import { computeAdvancementPropagation } from "@/lib/bracket-advancement";
import type { TournamentBracketSnapshot } from "@/lib/bracket-advancement";
import { prisma } from "@/lib/db";
import { determineMatchWinner } from "@/lib/match-result";
import { requireDomainAdmin } from "@/lib/permissions";
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

export type MatchFormInput = z.infer<typeof matchFormSchema>;
export type ScoreFormInput = z.infer<typeof scoreFormSchema>;

/**
 * Player-slot Selects in create-match-dialog.tsx (single-value, not
 * `multiple`) always register a hidden form input for their `name` even
 * with nothing picked yet (Base UI's own progressive-enhancement design -
 * the hidden `<input>` is unconditional, its `value` just serializes to ""
 * when the Select has no selection) - so an unpicked slot arrives here as
 * an empty string in the array, not as a missing entry. Without filtering
 * these out, a genuinely empty/placeholder side (matchFormSchema's
 * `playerIdList.min(0)`, meant for exactly this - a bracket slot whose
 * player isn't decided yet) always fails validation instead, since every
 * element must be a non-empty string.
 */
function nonEmptyFormValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}

export type ActionState = {
  error?: string;
  success?: boolean;
  notice?: string;
  fieldErrors?: Record<string, string>;
  /** Set only when saveScoreAction found downstream bracket matches that would be reset and the caller didn't yet confirm via acknowledgedCascadeReset - see bracket-advancement.ts. */
  cascadeResets?: CascadeReset[];
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

/** Shared by createMatchAction (web form) and POST /api/v1/matches (mobile) - see docs/MOBILE_API.md. */
export async function createMatchCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  data: MatchFormInput,
): Promise<ActionState> {
  const { tournamentId, matchType, round, scheduledDate, sideAPlayerIds, sideBPlayerIds } = data;

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

export async function createMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const parsed = matchFormSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    matchType: formData.get("matchType"),
    round: formData.get("round"),
    scheduledDate: formData.get("scheduledDate"),
    sideAPlayerIds: nonEmptyFormValues(formData, "sideAPlayerIds"),
    sideBPlayerIds: nonEmptyFormValues(formData, "sideBPlayerIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  return createMatchCore(session, parsed.data);
}

/** Shared by updateMatchAction (web form) and PATCH /api/v1/matches/[id] (mobile) - see docs/MOBILE_API.md. */
export async function updateMatchCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  matchId: string,
  data: MatchFormInput,
): Promise<ActionState> {
  const { matchType, round, scheduledDate, sideAPlayerIds, sideBPlayerIds } = data;

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

  // Same check createMatchAction already does: matchFormSchema only
  // shape-checks the ids (non-empty strings, no cross-side dupes), so
  // confirm every id is actually a registered participant of this
  // tournament before writing anything - a direct Server Function call
  // (bypassing the UI's roster-scoped <select>) could otherwise slip a
  // non-participant into MatchPlayer, which standings/rating computations
  // assume never happens.
  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId: currentMatch.tournamentId },
    select: { playerId: true },
  });
  const rosterIds = new Set(participants.map((p) => p.playerId));
  const allPlayerIds = [...sideAPlayerIds, ...sideBPlayerIds];
  if (!allPlayerIds.every((id) => rosterIds.has(id))) {
    return { error: "Гравець не зареєстрований у цьому турнірі" };
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
    if (isForeignKeyError(error)) {
      return { error: "Гравець не знайдено — можливо, його вже видалили" };
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

export async function updateMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Матч не знайдено" };
  }

  const parsed = matchFormSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    matchType: formData.get("matchType"),
    round: formData.get("round"),
    scheduledDate: formData.get("scheduledDate"),
    sideAPlayerIds: nonEmptyFormValues(formData, "sideAPlayerIds"),
    sideBPlayerIds: nonEmptyFormValues(formData, "sideBPlayerIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  return updateMatchCore(session, matchId, parsed.data);
}

/**
 * Thrown from inside saveScoreAction's/deleteMatchAction's transaction to
 * force a rollback when the atomic updateMany below finds the row already
 * changed - a plain early-return wouldn't undo the matchSet writes that
 * already ran in the same transaction.
 */
class StaleScoreConflictError extends Error {}

/** Shared by deleteMatchAction (web form) and DELETE /api/v1/matches/[id] (mobile) - see docs/MOBILE_API.md. */
export async function deleteMatchCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  matchId: string,
  acknowledgedCascadeReset: boolean,
): Promise<ActionState> {
  const existingMatch = await prisma.match.findUnique({
    where: { id: matchId },
    select: { tournamentId: true },
  });
  if (!existingMatch) {
    return { error: "Матч не знайдено — можливо, його вже видалили" };
  }

  // Cheap short-circuit, same as saveScoreAction: only bracket-shaped
  // tournaments (src/lib/groups12-playoff-bracket.ts) have any rows here.
  const hasAdvancements =
    (await prisma.matchAdvancement.count({ where: { tournamentId: existingMatch.tournamentId } })) > 0;

  try {
    await prisma.$transaction(async (tx) => {
      if (hasAdvancements) {
        // Build the snapshot before deleting, then treat this match as
        // having produced no result (CANCELLED) rather than removing it
        // outright - computeAdvancementPropagation only needs to see a
        // non-COMPLETED match to correctly null out (and cascade-reset) any
        // downstream slot that was auto-filled from its result, while still
        // seeing its real players/group to correctly re-evaluate group-rank
        // fills (a deleted group match can make that group's round robin
        // incomplete again). The row itself is deleted below, once
        // propagation is resolved - deleting it first would cascade-delete
        // the MatchAdvancement rows this needs to compute that propagation.
        const snapshot = await buildBracketSnapshot(tx, existingMatch.tournamentId);
        const snapshotForDeletion: TournamentBracketSnapshot = {
          ...snapshot,
          matches: snapshot.matches.map((m) =>
            m.id === matchId ? { ...m, status: "CANCELLED" as const } : m,
          ),
        };
        const propagation = computeAdvancementPropagation(snapshotForDeletion, matchId);

        if (propagation.resets.length > 0 && !acknowledgedCascadeReset) {
          const nameById = new Map(snapshot.participants.map((p) => [p.playerId, p.name]));
          const matchById = new Map(snapshot.matches.map((m) => [m.id, m]));
          throw new CascadeResetPendingError(
            propagation.resets.map((r) => {
              const m = matchById.get(r.matchId);
              const sideA = m?.players.find((p) => p.side === "A");
              const sideB = m?.players.find((p) => p.side === "B");
              return {
                matchId: r.matchId,
                round: r.round,
                sideALabel: sideA ? (nameById.get(sideA.playerId) ?? "?") : "?",
                sideBLabel: sideB ? (nameById.get(sideB.playerId) ?? "?") : "?",
              };
            }),
          );
        }

        for (const fill of propagation.fills) {
          await tx.matchPlayer.deleteMany({ where: { matchId: fill.matchId, side: fill.side } });
          if (fill.playerId) {
            await tx.matchPlayer.create({
              data: { matchId: fill.matchId, side: fill.side, playerId: fill.playerId },
            });
          }
        }
        const resetMatchIds = [...new Set(propagation.resets.map((r) => r.matchId))];
        if (resetMatchIds.length > 0) {
          await tx.matchSet.deleteMany({ where: { matchId: { in: resetMatchIds } } });
          await tx.match.updateMany({
            where: { id: { in: resetMatchIds } },
            data: { status: "SCHEDULED", winnerSide: null, completedAt: null, retired: false },
          });
        }
      }

      await tx.match.delete({ where: { id: matchId } });
    });
  } catch (error) {
    if (error instanceof CascadeResetPendingError) {
      return {
        error: "Видалення скине рахунок матчів нижче по сітці — підтвердьте скид, щоб продовжити.",
        cascadeResets: error.resets,
      };
    }
    if (isRecordNotFoundError(error)) {
      return { error: "Матч не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "match.delete",
    entityType: "Match",
    entityId: matchId,
    summary: `Видалено матч у турнірі ${existingMatch.tournamentId}`,
  }));

  revalidatePath(`/admin/tournaments/${existingMatch.tournamentId}`);
  revalidatePath(`/tournaments/${existingMatch.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}

export async function deleteMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Матч не знайдено" };
  }
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  return deleteMatchCore(session, matchId, acknowledgedCascadeReset);
}

/** Shared by saveScoreAction (web form) and POST /api/v1/matches/[id]/score (mobile) - see docs/MOBILE_API.md. */
export async function saveScoreCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  data: ScoreFormInput,
  acknowledgedCascadeReset: boolean,
): Promise<ActionState> {
  // A retirement's winner is whoever didn't retire - picked explicitly by
  // the admin, since the game count alone can't say who was actually ahead
  // when the match was conceded. Otherwise, derive it from the sets as usual.
  const winnerSide = data.retired ? data.retiredWinnerSide : determineMatchWinner(data.sets);
  if (!data.retired && data.sets.length > 0 && !winnerSide) {
    return { error: "Неможливо визначити переможця — рахунок сетів рівний" };
  }

  const existingMatch = await prisma.match.findUnique({
    where: { id: data.matchId },
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
  const expectedUpdatedAt = new Date(data.expectedUpdatedAt);
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

  // Cheap short-circuit: every tournament not created via a bracket-shaped
  // randomizer (src/lib/groups12-playoff-bracket.ts) has zero rows here, so
  // this stays a single indexed count() with no effect on the vast majority
  // of score saves.
  const hasAdvancements =
    (await prisma.matchAdvancement.count({ where: { tournamentId: existingMatch.tournamentId } })) > 0;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.matchSet.deleteMany({ where: { matchId: data.matchId } });
      await tx.matchSet.createMany({
        data: data.sets.map((set, index) => ({
          matchId: data.matchId,
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
        where: { id: data.matchId, updatedAt: expectedUpdatedAt },
        data: {
          status: winnerSide ? "COMPLETED" : "SCHEDULED",
          winnerSide,
          retired: data.retired,
          completedAt,
        },
      });
      if (result.count === 0) {
        throw new StaleScoreConflictError();
      }

      if (!hasAdvancements) return;

      // Read back the bracket AFTER the write above, so the snapshot already
      // reflects this match's new result - propagation starts from there.
      const snapshot = await buildBracketSnapshot(tx, existingMatch.tournamentId);
      const propagation = computeAdvancementPropagation(snapshot, data.matchId);

      if (propagation.resets.length > 0 && !acknowledgedCascadeReset) {
        const nameById = new Map(snapshot.participants.map((p) => [p.playerId, p.name]));
        const matchById = new Map(snapshot.matches.map((m) => [m.id, m]));
        throw new CascadeResetPendingError(
          propagation.resets.map((r) => {
            const m = matchById.get(r.matchId);
            const sideA = m?.players.find((p) => p.side === "A");
            const sideB = m?.players.find((p) => p.side === "B");
            return {
              matchId: r.matchId,
              round: r.round,
              sideALabel: sideA ? (nameById.get(sideA.playerId) ?? "?") : "?",
              sideBLabel: sideB ? (nameById.get(sideB.playerId) ?? "?") : "?",
            };
          }),
        );
      }

      for (const fill of propagation.fills) {
        await tx.matchPlayer.deleteMany({ where: { matchId: fill.matchId, side: fill.side } });
        if (fill.playerId) {
          await tx.matchPlayer.create({ data: { matchId: fill.matchId, side: fill.side, playerId: fill.playerId } });
        }
      }
      const resetMatchIds = [...new Set(propagation.resets.map((r) => r.matchId))];
      if (resetMatchIds.length > 0) {
        await tx.matchSet.deleteMany({ where: { matchId: { in: resetMatchIds } } });
        await tx.match.updateMany({
          where: { id: { in: resetMatchIds } },
          data: { status: "SCHEDULED", winnerSide: null, completedAt: null, retired: false },
        });
      }
    });
  } catch (error) {
    if (error instanceof CascadeResetPendingError) {
      return {
        error: "Цей результат скине рахунок матчів нижче по сітці — підтвердьте скид, щоб продовжити.",
        cascadeResets: error.resets,
      };
    }
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
    entityId: data.matchId,
    summary: data.retired ? "Збережено рахунок матчу (завершено зняттям гравця)" : "Збережено рахунок матчу",
  }));

  revalidatePath(`/admin/tournaments/${existingMatch.tournamentId}`);
  revalidatePath(`/tournaments/${existingMatch.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}

export async function saveScoreAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

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
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  return saveScoreCore(session, parsed.data, acknowledgedCascadeReset);
}
