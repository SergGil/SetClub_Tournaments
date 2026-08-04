"use server";

import { randomUUID } from "node:crypto";

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
import {
  assignUngroupedToGroups,
  buildCustomGroupsSinglesRoundRobin,
  buildRandomDoublesPairing,
  buildSeededSinglesRoundRobin,
  buildSinglesRoundRobin,
  groupRoundLabel,
  MAX_TOURNAMENT_GROUPS,
  shuffle,
  SINGLES_GROUP_LABEL,
} from "@/lib/randomize-pairs";
import type { SinglesRandomizeStrategy, Team } from "@/lib/randomize-pairs";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";
import { matchFormSchema, scoreFormSchema } from "@/lib/validation/match";

export type ActionState = { error?: string; success?: boolean; notice?: string };

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
    return { error: parsed.error.issues[0]?.message ?? "Некоректний рахунок" };
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

export type NamedPlayer = { playerId: string; name: string };
export type NamedTeam = { playerIds: [string, string]; names: [string, string] };
export type NamedMatchup = { sideA: NamedTeam; sideB: NamedTeam };

export type DrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      fixedTeams: NamedTeam[];
      seededBasket: NamedPlayer[];
      unseededBasket: NamedPlayer[];
      randomTeams: NamedTeam[];
      matchups: NamedMatchup[];
      unpairedNames: string[];
    };

/**
 * Computes (but does not persist) a random doubles draw: teams pairing one
 * "seeded" with one "unseeded" player where possible, then a round-robin of
 * every team against every other. Read-only, so the UI can animate the draw
 * before the admin commits it via commitDoublesMatchesAction.
 *
 * `fixedPairs` lets the admin lock in one or a few teams ahead of the random
 * draw - those players are excluded from the random pairing and their team
 * is added back in before the round robin is built.
 */
export async function drawDoublesTeamsAction(
  tournamentId: string,
  fixedPairs: [string, string][] = [],
): Promise<DrawState> {
  await requireAdmin();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (!tournament) return { ok: false, error: "Турнір не знайдено" };
  if (tournament.format !== "DOUBLES") {
    return { ok: false, error: "Рандомайзер доступний лише для парних турнірів" };
  }

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { playerId: true, seed: true, player: { select: { name: true } } },
  });
  if (participants.length < 4) {
    return { ok: false, error: "Потрібно щонайменше 4 учасники для парного розіграшу" };
  }
  if (!participants.some((p) => p.seed !== null)) {
    return { ok: false, error: "Позначте хоча б одного гравця як сіяного" };
  }

  const rosterIds = new Set(participants.map((p) => p.playerId));
  const seenInFixedPairs = new Set<string>();
  for (const pair of fixedPairs) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      return { ok: false, error: "Некоректна заздалегідь визначена пара" };
    }
    if (pair[0] === pair[1]) {
      return { ok: false, error: "Пара не може складатися з одного й того ж гравця" };
    }
    for (const playerId of pair) {
      if (typeof playerId !== "string" || !rosterIds.has(playerId)) {
        return { ok: false, error: "Гравець із заздалегідь визначеної пари не належить турніру" };
      }
      if (seenInFixedPairs.has(playerId)) {
        return { ok: false, error: "Гравець не може бути у двох заздалегідь визначених парах" };
      }
      seenInFixedPairs.add(playerId);
    }
  }

  const nameById = new Map(participants.map((p) => [p.playerId, p.player.name]));
  const { seededOrder, unseededOrder, fixedTeams, randomTeams, matchups, unpaired } =
    buildRandomDoublesPairing(
      participants.map((p) => ({ playerId: p.playerId, seeded: p.seed !== null })),
      fixedPairs,
    );
  if (matchups.length === 0) {
    return { ok: false, error: "Не вдалося сформувати жодної пари" };
  }

  const withNames = (ids: string[]): NamedPlayer[] =>
    ids.map((playerId) => ({ playerId, name: nameById.get(playerId) ?? "?" }));
  const teamWithNames = (team: Team): NamedTeam => ({
    playerIds: team.playerIds,
    names: [nameById.get(team.playerIds[0]) ?? "?", nameById.get(team.playerIds[1]) ?? "?"],
  });

  return {
    ok: true,
    fixedTeams: fixedTeams.map(teamWithNames),
    // Shuffled again, independently of the pairing order below, so the
    // basket display doesn't give away the pairing pattern (e.g. row 1
    // always crossing off with row 1) as pairs are revealed.
    seededBasket: withNames(shuffle(seededOrder)),
    unseededBasket: withNames(shuffle(unseededOrder)),
    randomTeams: randomTeams.map(teamWithNames),
    matchups: matchups.map((m) => ({ sideA: teamWithNames(m.sideA), sideB: teamWithNames(m.sideB) })),
    unpairedNames: unpaired.map((playerId) => nameById.get(playerId) ?? "?"),
  };
}

export type CommitState = { error?: string; success?: boolean; matchCount?: number };

/**
 * Persists an exact draw previously returned by drawDoublesTeamsAction. Any
 * matches already in the tournament are cleared first, so re-running the
 * randomizer ("Рерандомайзер") replaces the previous draw instead of piling
 * duplicate matches on top of it.
 */
export async function commitDoublesMatchesAction(
  tournamentId: string,
  matchups: { sideAIds: [string, string]; sideBIds: [string, string] }[],
): Promise<CommitState> {
  const session = await requireAdmin();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true, startDate: true },
  });
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "DOUBLES") {
    return { error: "Рандомайзер доступний лише для парних турнірів" };
  }
  if (matchups.length === 0) {
    return { error: "Немає матчів для створення" };
  }

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { playerId: true },
  });
  const rosterIds = new Set(participants.map((p) => p.playerId));

  if (!Array.isArray(matchups)) {
    return { error: "Некоректні дані розіграшу" };
  }
  for (const matchup of matchups) {
    const shapeValid =
      typeof matchup === "object" &&
      matchup !== null &&
      Array.isArray(matchup.sideAIds) &&
      Array.isArray(matchup.sideBIds) &&
      matchup.sideAIds.length === 2 &&
      matchup.sideBIds.length === 2;
    if (!shapeValid) {
      return { error: "Некоректні дані розіграшу" };
    }

    const ids = [...matchup.sideAIds, ...matchup.sideBIds];
    const allKnown = ids.every((id) => typeof id === "string" && rosterIds.has(id));
    const allUnique = new Set(ids).size === ids.length;
    if (!allKnown || !allUnique) {
      return { error: "Некоректні дані розіграшу" };
    }
  }

  // Bulk createMany instead of one match.create(...) per matchup with a
  // nested players.create: a round robin over a real-sized roster is dozens
  // of matches, and each nested create is its own round trip to the (remote,
  // serverless) database - enough of those in one interactive transaction
  // blows past Prisma's 5s default timeout. Two createMany calls stay at a
  // constant number of round trips no matter the roster size, so IDs are
  // generated here (rather than left to the DB default) to link each
  // MatchPlayer row to its Match before either has actually been inserted.
  const rows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));

  // Match has no unique constraint tying it to a tournament, so two
  // concurrent commits (double-click, two admin tabs) could otherwise
  // interleave their delete+insert under READ COMMITTED and both leave
  // matches behind. Serialize commits per tournament with an advisory lock
  // held for the transaction's lifetime - still a constant 4 round trips,
  // so it doesn't reintroduce the round-trip-per-matchup problem above.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 0)`;
    await tx.match.deleteMany({ where: { tournamentId } });
    await tx.match.createMany({
      data: rows.map(({ id }) => ({
        id,
        tournamentId,
        matchType: "DOUBLES",
        scheduledDate: tournament.startDate,
      })),
    });
    await tx.matchPlayer.createMany({
      data: rows.flatMap(({ id, matchup }) => [
        ...matchup.sideAIds.map((playerId) => ({ matchId: id, side: "A" as const, playerId })),
        ...matchup.sideBIds.map((playerId) => ({ matchId: id, side: "B" as const, playerId })),
      ]),
    });
  });

  after(() => logAudit(session.user, {
    action: "match.randomize",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Рандомайзер (парний): згенеровано ${matchups.length} матч(ів)`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true, matchCount: matchups.length };
}

/**
 * Generates and persists a round robin for a SINGLES tournament's roster.
 * Two strategies:
 *  - "ALL": every participant plays every other participant once.
 *  - "SEEDED_SPLIT": seeded participants round-robin only against other
 *    seeded participants, and unseeded only against other unseeded - the
 *    resulting matches are tagged via `round` so the UI can badge them.
 * Like the doubles randomizer, re-running it ("Рерандомайзер") replaces any
 * existing matches rather than piling duplicates on top.
 *
 * The third strategy, "CUSTOM_GROUPS", goes through drawSinglesGroupsAction /
 * commitSinglesGroupsAction instead (below) - it needs a read-only draw step
 * so the UI can animate ungrouped players landing in their group before
 * anything is persisted, the same way the doubles randomizer's draw works.
 */
export async function commitSinglesRoundRobinAction(
  tournamentId: string,
  strategy: Exclude<SinglesRandomizeStrategy, "CUSTOM_GROUPS">,
): Promise<CommitState> {
  const session = await requireAdmin();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true, startDate: true },
  });
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "SINGLES") {
    return { error: "Рандомайзер доступний лише для одиночних турнірів" };
  }

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { playerId: true, seed: true },
  });
  if (participants.length < 2) {
    return { error: "Потрібно щонайменше 2 учасники" };
  }

  if (strategy === "SEEDED_SPLIT") {
    // buildSeededSinglesRoundRobin runs two independent round robins (seeded
    // pool, unseeded pool) - a pool of exactly 1 produces 0 matchups for
    // just that pool, but the OTHER pool can still produce plenty, so
    // checking only the combined total (below) would silently register a
    // participant for the tournament with zero scheduled matches.
    const seededCount = participants.filter((p) => p.seed !== null).length;
    const unseededCount = participants.length - seededCount;
    if (seededCount === 1) {
      return {
        error:
          "У сіяних лише 1 учасник — для нього не буде жодного матчу. Додайте ще сіяного гравця або зніміть позначку «сіяний».",
      };
    }
    if (unseededCount === 1) {
      return {
        error:
          "У несіяних лише 1 учасник — для нього не буде жодного матчу. Додайте ще несіяного гравця або позначте його сіяним.",
      };
    }
  }

  const matchups: { sideA: string; sideB: string; round: string | null }[] =
    strategy === "SEEDED_SPLIT"
      ? buildSeededSinglesRoundRobin(
          participants.map((p) => ({ playerId: p.playerId, seeded: p.seed !== null })),
        ).map((m) => ({ sideA: m.sideA, sideB: m.sideB, round: SINGLES_GROUP_LABEL[m.group] }))
      : buildSinglesRoundRobin(participants.map((p) => p.playerId)).map((m) => ({
          ...m,
          round: null,
        }));

  if (matchups.length === 0) {
    return {
      error:
        strategy === "SEEDED_SPLIT"
          ? "За такого розподілу сіяних/несіяних жоден матч не сформується"
          : "Не вдалося сформувати жодного матчу",
    };
  }

  // Same bulk-createMany approach as the doubles randomizer above, and for
  // the same reason: a round robin over a real roster is dozens of matches,
  // too many nested-create round trips to fit one interactive transaction's
  // 5s timeout against a remote database.
  const rows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));

  // See commitDoublesMatchesAction: serialize commits per tournament so two
  // concurrent commits can't interleave their delete+insert and both leave
  // matches behind.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 0)`;
    await tx.match.deleteMany({ where: { tournamentId } });
    await tx.match.createMany({
      data: rows.map(({ id, matchup }) => ({
        id,
        tournamentId,
        matchType: "SINGLES",
        scheduledDate: tournament.startDate,
        round: matchup.round,
      })),
    });
    await tx.matchPlayer.createMany({
      data: rows.flatMap(({ id, matchup }) => [
        { matchId: id, side: "A" as const, playerId: matchup.sideA },
        { matchId: id, side: "B" as const, playerId: matchup.sideB },
      ]),
    });
  });

  after(() => logAudit(session.user, {
    action: "match.randomize",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Рандомайзер (одиночний, ${strategy}): згенеровано ${matchups.length} матч(ів)`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true, matchCount: matchups.length };
}

export type NamedGroup = { group: number; players: NamedPlayer[] };
export type NamedSinglesMatchup = { sideA: NamedPlayer; sideB: NamedPlayer; round: string };

export type SinglesGroupDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Players who already had a group assigned before the draw, grouped and sorted. */
      existingGroups: NamedGroup[];
      /** Previously-ungrouped players, in the order they should be revealed. */
      revealOrder: NamedPlayer[];
      /** Where each revealOrder player landed - playerId -> group. */
      groupAssignment: Record<string, number>;
      matchups: NamedSinglesMatchup[];
    };

/**
 * Computes (but does not persist) a "За групами" draw: fills in a group for
 * every ungrouped participant (see assignUngroupedToGroups), then a round
 * robin within each group. Read-only, so the UI can animate players landing
 * in their group before the admin commits via commitSinglesGroupsAction -
 * the same draw/commit split the doubles randomizer uses.
 */
export async function drawSinglesGroupsAction(tournamentId: string): Promise<SinglesGroupDrawState> {
  await requireAdmin();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (!tournament) return { ok: false, error: "Турнір не знайдено" };
  if (tournament.format !== "SINGLES") {
    return { ok: false, error: "Рандомайзер доступний лише для одиночних турнірів" };
  }

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { playerId: true, group: true, player: { select: { name: true } } },
  });
  if (participants.length < 2) {
    return { ok: false, error: "Потрібно щонайменше 2 учасники" };
  }
  if (!participants.some((p) => p.group !== null)) {
    return { ok: false, error: "Призначте бодай одному гравцю групу вручну в ростері" };
  }

  const nameById = new Map(participants.map((p) => [p.playerId, p.player.name]));
  const named = (playerId: string): NamedPlayer => ({ playerId, name: nameById.get(playerId) ?? "?" });

  const groupAssignmentMap = assignUngroupedToGroups(
    participants.map((p) => ({ playerId: p.playerId, group: p.group })),
  );

  const existingByGroup = new Map<number, NamedPlayer[]>();
  for (const p of participants) {
    if (p.group == null) continue;
    const list = existingByGroup.get(p.group);
    if (list) list.push(named(p.playerId));
    else existingByGroup.set(p.group, [named(p.playerId)]);
  }
  const existingGroups: NamedGroup[] = [...existingByGroup.entries()]
    .sort(([a], [b]) => a - b)
    .map(([group, players]) => ({ group, players }));

  const revealOrder = [...groupAssignmentMap.keys()].map(named);

  const effectiveGroups = participants
    .map((p) => ({ playerId: p.playerId, group: groupAssignmentMap.get(p.playerId) ?? p.group }))
    .filter((p): p is { playerId: string; group: number } => p.group != null);

  const matchups: NamedSinglesMatchup[] = buildCustomGroupsSinglesRoundRobin(effectiveGroups).map(
    (m) => ({ sideA: named(m.sideA), sideB: named(m.sideB), round: groupRoundLabel(m.group) }),
  );

  if (matchups.length === 0) {
    return { ok: false, error: "За таким розподілом по групах жоден матч не сформується" };
  }

  return {
    ok: true,
    existingGroups,
    revealOrder,
    groupAssignment: Object.fromEntries(groupAssignmentMap),
    matchups,
  };
}

/**
 * Persists an exact draw previously returned by drawSinglesGroupsAction:
 * assigns any newly-drawn players' groups on the roster, then replaces the
 * tournament's matches, both in one transaction.
 */
export async function commitSinglesGroupsAction(
  tournamentId: string,
  groupAssignment: Record<string, number>,
  matchups: { sideA: string; sideB: string; round: string }[],
): Promise<CommitState> {
  const session = await requireAdmin();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true, startDate: true },
  });
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "SINGLES") {
    return { error: "Рандомайзер доступний лише для одиночних турнірів" };
  }
  if (!Array.isArray(matchups) || matchups.length === 0) {
    return { error: "Немає матчів для створення" };
  }

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { playerId: true },
  });
  const rosterIds = new Set(participants.map((p) => p.playerId));

  for (const matchup of matchups) {
    const shapeValid =
      typeof matchup === "object" &&
      matchup !== null &&
      typeof matchup.sideA === "string" &&
      typeof matchup.sideB === "string" &&
      typeof matchup.round === "string";
    if (!shapeValid || matchup.sideA === matchup.sideB) {
      return { error: "Некоректні дані розіграшу" };
    }
    if (!rosterIds.has(matchup.sideA) || !rosterIds.has(matchup.sideB)) {
      return { error: "Некоректні дані розіграшу" };
    }
  }

  if (typeof groupAssignment !== "object" || groupAssignment === null || Array.isArray(groupAssignment)) {
    return { error: "Некоректні дані розіграшу" };
  }
  const assignmentEntries = Object.entries(groupAssignment);
  for (const [playerId, group] of assignmentEntries) {
    if (!rosterIds.has(playerId) || !Number.isInteger(group) || group < 1 || group > MAX_TOURNAMENT_GROUPS) {
      return { error: "Некоректні дані розіграшу" };
    }
  }

  const rows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 0)`;
    if (assignmentEntries.length > 0) {
      await Promise.all(
        assignmentEntries.map(([playerId, group]) =>
          tx.tournamentParticipant.update({
            where: { tournamentId_playerId: { tournamentId, playerId } },
            data: { group },
          }),
        ),
      );
    }
    await tx.match.deleteMany({ where: { tournamentId } });
    await tx.match.createMany({
      data: rows.map(({ id, matchup }) => ({
        id,
        tournamentId,
        matchType: "SINGLES",
        scheduledDate: tournament.startDate,
        round: matchup.round,
      })),
    });
    await tx.matchPlayer.createMany({
      data: rows.flatMap(({ id, matchup }) => [
        { matchId: id, side: "A" as const, playerId: matchup.sideA },
        { matchId: id, side: "B" as const, playerId: matchup.sideB },
      ]),
    });
  });

  after(() => logAudit(session.user, {
    action: "match.randomize",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Рандомайзер (одиночний, CUSTOM_GROUPS): згенеровано ${matchups.length} матч(ів)`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true, matchCount: matchups.length };
}
