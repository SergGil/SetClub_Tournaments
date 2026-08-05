"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { checkCompletedMatchesAcknowledged } from "@/lib/actions/match-randomize-shared";
import type { CommitState, NamedPlayer } from "@/lib/actions/match-randomize-shared";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { buildRandomDoublesPairing, shuffle } from "@/lib/randomize-pairs";
import type { Team } from "@/lib/randomize-pairs";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";

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

/**
 * Persists an exact draw previously returned by drawDoublesTeamsAction. Any
 * matches already in the tournament are cleared first, so re-running the
 * randomizer ("Рерандомайзер") replaces the previous draw instead of piling
 * duplicate matches on top of it.
 */
export async function commitDoublesMatchesAction(
  tournamentId: string,
  matchups: { sideAIds: [string, string]; sideBIds: [string, string] }[],
  acknowledgedCompletedLoss: boolean,
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

  const completedError = await checkCompletedMatchesAcknowledged(tournamentId, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

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
