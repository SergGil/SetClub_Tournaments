"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";

import { prisma } from "@/lib/db";
import { determineMatchWinner } from "@/lib/match-result";
import { requireAdmin } from "@/lib/permissions";
import { isForeignKeyError, isRecordNotFoundError } from "@/lib/prisma-errors";
import {
  buildRandomDoublesPairing,
  buildSeededSinglesRoundRobin,
  buildSinglesRoundRobin,
  SINGLES_GROUP_LABEL,
} from "@/lib/randomize-pairs";
import type { SinglesRandomizeStrategy, Team } from "@/lib/randomize-pairs";
import { STATS_CACHE_TAG } from "@/lib/stats";
import { matchFormSchema, scoreFormSchema } from "@/lib/validation/match";

export type ActionState = { error?: string; success?: boolean; notice?: string };

export async function createMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

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

  try {
    await prisma.match.create({
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
    throw error;
  }

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  return { success: true };
}

export async function updateMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

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
            ? { status: "SCHEDULED" as const, winnerSide: null, retired: false }
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
    throw error;
  }

  // Revalidate the match's real tournament, not whatever tournamentId the client sent.
  revalidatePath(`/admin/tournaments/${updatedMatch.tournamentId}`);
  revalidatePath(`/tournaments/${updatedMatch.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
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
  await requireAdmin();

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

  revalidatePath(`/admin/tournaments/${deleted.tournamentId}`);
  revalidatePath(`/tournaments/${deleted.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  return { success: true };
}

export async function saveScoreAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  let rawSets: unknown;
  try {
    rawSets = JSON.parse(String(formData.get("setsJson") ?? "[]"));
  } catch {
    return { error: "Некоректний рахунок" };
  }

  const parsed = scoreFormSchema.safeParse({
    matchId: formData.get("matchId"),
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

  let updatedMatch;
  try {
    [, , updatedMatch] = await prisma.$transaction([
      prisma.matchSet.deleteMany({ where: { matchId: parsed.data.matchId } }),
      prisma.matchSet.createMany({
        data: parsed.data.sets.map((set, index) => ({
          matchId: parsed.data.matchId,
          setNumber: index + 1,
          sideAGames: set.sideAGames,
          sideBGames: set.sideBGames,
          tiebreakSideAPoints: set.tiebreakSideAPoints ?? null,
          tiebreakSideBPoints: set.tiebreakSideBPoints ?? null,
        })),
      }),
      prisma.match.update({
        where: { id: parsed.data.matchId },
        data: {
          status: winnerSide ? "COMPLETED" : "SCHEDULED",
          winnerSide,
          retired: parsed.data.retired,
        },
      }),
    ]);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Матч не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  revalidatePath(`/admin/tournaments/${updatedMatch.tournamentId}`);
  revalidatePath(`/tournaments/${updatedMatch.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
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
    seededBasket: withNames(seededOrder),
    unseededBasket: withNames(unseededOrder),
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
  await requireAdmin();

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

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
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
 */
export async function commitSinglesRoundRobinAction(
  tournamentId: string,
  strategy: SinglesRandomizeStrategy,
): Promise<CommitState> {
  await requireAdmin();

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

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  return { success: true, matchCount: matchups.length };
}
