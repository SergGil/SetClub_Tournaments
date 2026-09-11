"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { checkCompletedMatchesAcknowledged } from "@/lib/actions/match-randomize-shared";
import type { CommitState, NamedPlayer } from "@/lib/actions/match-randomize-shared";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { BracketSlotSource } from "@/lib/doubles-group-playoff-bracket";
import { DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN } from "@/lib/doubles-group-playoff-bracket";
import { requireDomainAdmin } from "@/lib/permissions";
import { fullDisplayName } from "@/lib/player-display";
import { PLAYOFF_DISPLAY_ORDER } from "@/lib/playoff-rounds";
import {
  assignUngroupedDoublesToGroups,
  buildCustomGroupsDoublesRoundRobin,
  buildRandomDoublesPairing,
  MAX_TOURNAMENT_GROUPS,
  resolveGroupLabel,
  shuffle,
} from "@/lib/randomize-pairs";
import type { Team } from "@/lib/randomize-pairs";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";

const GROUP_PLAYOFF_ELIGIBILITY_ERROR = "Плей-офф доступний лише коли рівно 2 групи по 4 пари кожна";

/**
 * withPlayoff (see docs/DOUBLES_GROUP_PLAYOFF.md) needs exactly 2 groups of
 * exactly 4 teams each to seed its fixed 8-match bracket - derived directly
 * from the matchups actually being drawn/committed (not from participant
 * headcount) so it stays correct regardless of how the groups came about
 * (a fresh split, pre-existing roster groups, or a mismatched groupCount).
 * On success, also returns the 2 real TournamentParticipant.group numbers
 * actually in play, sorted ascending - DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN's
 * `group: 1 | 2` are bracket-relative (lower number = "A"/upper seed), not
 * literal roster group numbers, since an admin picking from pre-existing
 * groups could easily end up with e.g. groups 3 and 5 in play instead of 1
 * and 2.
 */
function validateGroupPlayoffEligibility(
  matchups: { sideAIds: [string, string]; sideBIds: [string, string]; group: number }[],
): { ok: false; error: string } | { ok: true; groups: [number, number] } {
  const teamsByGroup = new Map<number, Set<string>>();
  const teamKey = (ids: [string, string]) => [...ids].sort().join("+");
  for (const m of matchups) {
    const set = teamsByGroup.get(m.group) ?? new Set<string>();
    set.add(teamKey(m.sideAIds));
    set.add(teamKey(m.sideBIds));
    teamsByGroup.set(m.group, set);
  }
  if (teamsByGroup.size !== 2) return { ok: false, error: GROUP_PLAYOFF_ELIGIBILITY_ERROR };
  if ([...teamsByGroup.values()].some((teams) => teams.size !== 4)) {
    return { ok: false, error: GROUP_PLAYOFF_ELIGIBILITY_ERROR };
  }
  const [groupA, groupB] = [...teamsByGroup.keys()].sort((a, b) => a - b);
  return { ok: true, groups: [groupA, groupB] };
}

export type NamedTeam = { playerIds: [string, string]; names: [string, string] };
export type NamedMatchup = { sideA: NamedTeam; sideB: NamedTeam };

/**
 * Shared shape/self-pair/roster-membership/duplicate-player validation for
 * an admin-supplied `fixedPairs` list - used by both the flat ("ALL") and
 * the "За групами" doubles draws.
 */
function validateFixedPairs(fixedPairs: unknown, rosterIds: Set<string>): string | null {
  if (!Array.isArray(fixedPairs)) return "Некоректна заздалегідь визначена пара";
  const seen = new Set<string>();
  for (const pair of fixedPairs) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      return "Некоректна заздалегідь визначена пара";
    }
    if (pair[0] === pair[1]) {
      return "Пара не може складатися з одного й того ж гравця";
    }
    for (const playerId of pair) {
      if (typeof playerId !== "string" || !rosterIds.has(playerId)) {
        return "Гравець із заздалегідь визначеної пари не належить турніру";
      }
      if (seen.has(playerId)) {
        return "Гравець не може бути у двох заздалегідь визначених парах";
      }
      seen.add(playerId);
    }
  }
  return null;
}

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
  request?: Request,
): Promise<DrawState> {
  await requireDomainAdmin("TENNIS", request);

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
    select: { playerId: true, seed: true, player: { select: { name: true, nickname: true } } },
  });
  if (participants.length < 4) {
    return { ok: false, error: "Потрібно щонайменше 4 учасники для парного розіграшу" };
  }

  const rosterIds = new Set(participants.map((p) => p.playerId));
  const fixedPairsError = validateFixedPairs(fixedPairs, rosterIds);
  if (fixedPairsError) return { ok: false, error: fixedPairsError };

  const nameById = new Map(participants.map((p) => [p.playerId, fullDisplayName(p.player)]));
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
  request?: Request,
): Promise<CommitState> {
  const session = await requireDomainAdmin("TENNIS", request);

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

export type NamedGroupedTeam = { playerIds: [string, string]; names: [string, string]; group: number };
export type NamedGroupedMatchup = { sideA: NamedGroupedTeam; sideB: NamedGroupedTeam; group: number };

export type DoublesGroupDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Groups actually in play (some or all of the roster's assigned groups), sorted. */
      groups: number[];
      fixedTeams: NamedGroupedTeam[];
      /** Random teams in reveal order - grouped sequentially (all of group 1's teams, then group 2's, ...). */
      randomTeams: NamedGroupedTeam[];
      /** Newly auto-balanced players (individuals and ungrouped fixed-pair members) - playerId -> group. */
      groupAssignment: Record<string, number>;
      matchups: NamedGroupedMatchup[];
      unpairedNames: string[];
    };

/**
 * Computes (but does not persist) a "За групами" doubles draw: fills in a
 * group for every ungrouped participant (see assignUngroupedDoublesToGroups
 * - a fixed pair is dealt as one unit so it can't split across two groups),
 * then runs the flat seeded/unseeded basket draw independently inside each
 * group. Read-only, so the UI can animate the draw before the admin commits
 * it via commitDoublesGroupsAction - the same draw/commit split the flat
 * ("ALL") doubles draw and the singles "За групами" draw both use.
 *
 * `groupCount` lets the admin split a roster with no pre-assigned groups
 * into that many fresh random groups in one step, instead of first having to
 * hand-assign a group to someone in the roster - it's only consulted when
 * nobody already has a group (an existing roster split always wins).
 */
export async function drawDoublesGroupsAction(
  tournamentId: string,
  fixedPairs: [string, string][] = [],
  groupCount?: number,
  withPlayoff = false,
  request?: Request,
): Promise<DoublesGroupDrawState> {
  await requireDomainAdmin("TENNIS", request);

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
    select: { playerId: true, seed: true, group: true, player: { select: { name: true, nickname: true } } },
  });
  if (participants.length < 4) {
    return { ok: false, error: "Потрібно щонайменше 4 учасники для парного розіграшу" };
  }
  const hasExistingGroups = participants.some((p) => p.group !== null);
  if (!hasExistingGroups && (!Number.isInteger(groupCount) || groupCount! < 2 || groupCount! > MAX_TOURNAMENT_GROUPS)) {
    return {
      ok: false,
      error: `Призначте групу вручну в ростері або вкажіть кількість груп (2-${MAX_TOURNAMENT_GROUPS})`,
    };
  }

  const rosterIds = new Set(participants.map((p) => p.playerId));
  const fixedPairsError = validateFixedPairs(fixedPairs, rosterIds);
  if (fixedPairsError) return { ok: false, error: fixedPairsError };

  const groupById = new Map(participants.map((p) => [p.playerId, p.group]));
  for (const [a, b] of fixedPairs) {
    const groupA = groupById.get(a) ?? null;
    const groupB = groupById.get(b) ?? null;
    if (groupA !== null && groupB !== null && groupA !== groupB) {
      return {
        ok: false,
        error: "Гравці заздалегідь визначеної пари в різних групах — виправте групи в ростері",
      };
    }
  }

  const nameById = new Map(participants.map((p) => [p.playerId, fullDisplayName(p.player)]));

  const groupAssignmentMap = assignUngroupedDoublesToGroups(
    participants.map((p) => ({ playerId: p.playerId, group: p.group, seeded: p.seed !== null })),
    fixedPairs,
    hasExistingGroups ? undefined : groupCount,
  );

  const effectiveParticipants = participants
    .map((p) => ({
      playerId: p.playerId,
      seeded: p.seed !== null,
      group: groupAssignmentMap.get(p.playerId) ?? p.group,
    }))
    .filter((p): p is { playerId: string; seeded: boolean; group: number } => p.group != null);

  const { fixedTeams, randomTeams, matchups, unpaired } = buildCustomGroupsDoublesRoundRobin(
    effectiveParticipants,
    fixedPairs,
  );

  if (matchups.length === 0) {
    return { ok: false, error: "За таким розподілом по групах жоден матч не сформується" };
  }

  if (withPlayoff) {
    const eligibility = validateGroupPlayoffEligibility(
      matchups.map((m) => ({ sideAIds: m.sideA.playerIds, sideBIds: m.sideB.playerIds, group: m.group })),
    );
    if (!eligibility.ok) return { ok: false, error: eligibility.error };
  }

  const teamWithNames = (t: Team & { group: number }): NamedGroupedTeam => ({
    playerIds: t.playerIds,
    names: [nameById.get(t.playerIds[0]) ?? "?", nameById.get(t.playerIds[1]) ?? "?"],
    group: t.group,
  });

  return {
    ok: true,
    groups: [...new Set(effectiveParticipants.map((p) => p.group))].sort((a, b) => a - b),
    fixedTeams: fixedTeams.map(teamWithNames),
    randomTeams: randomTeams.map(teamWithNames),
    groupAssignment: Object.fromEntries(groupAssignmentMap),
    matchups: matchups.map((m) => ({
      sideA: teamWithNames({ ...m.sideA, group: m.group }),
      sideB: teamWithNames({ ...m.sideB, group: m.group }),
      group: m.group,
    })),
    unpairedNames: unpaired.map((playerId) => nameById.get(playerId) ?? "?"),
  };
}

/**
 * Persists an exact draw previously returned by drawDoublesGroupsAction:
 * assigns any newly-drawn players' groups on the roster, then replaces the
 * tournament's matches (each tagged with its group's round label so the
 * match list and standings can badge/bracket by group), both in one
 * transaction. Mirrors commitSinglesGroupsAction.
 */
export async function commitDoublesGroupsAction(
  tournamentId: string,
  groupAssignment: Record<string, number>,
  matchups: { sideAIds: [string, string]; sideBIds: [string, string]; group: number }[],
  acknowledgedCompletedLoss: boolean,
  withPlayoff = false,
  request?: Request,
): Promise<CommitState> {
  const session = await requireDomainAdmin("TENNIS", request);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true, startDate: true },
  });
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "DOUBLES") {
    return { error: "Рандомайзер доступний лише для парних турнірів" };
  }
  if (!Array.isArray(matchups) || matchups.length === 0) {
    return { error: "Немає матчів для створення" };
  }

  const completedError = await checkCompletedMatchesAcknowledged(tournamentId, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const [participants, customGroups] = await Promise.all([
    prisma.tournamentParticipant.findMany({ where: { tournamentId }, select: { playerId: true } }),
    prisma.tournamentGroup.findMany({ where: { tournamentId }, select: { number: true, name: true } }),
  ]);
  const rosterIds = new Set(participants.map((p) => p.playerId));
  const customGroupNumbers = new Set(customGroups.map((g) => g.number));
  const customGroupNames = new Map(customGroups.map((g) => [g.number, g.name]));

  for (const matchup of matchups) {
    const shapeValid =
      typeof matchup === "object" &&
      matchup !== null &&
      Array.isArray(matchup.sideAIds) &&
      Array.isArray(matchup.sideBIds) &&
      matchup.sideAIds.length === 2 &&
      matchup.sideBIds.length === 2 &&
      Number.isInteger(matchup.group) &&
      matchup.group >= 1 &&
      (matchup.group <= MAX_TOURNAMENT_GROUPS || customGroupNumbers.has(matchup.group));
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

  if (typeof groupAssignment !== "object" || groupAssignment === null || Array.isArray(groupAssignment)) {
    return { error: "Некоректні дані розіграшу" };
  }
  const assignmentEntries = Object.entries(groupAssignment);
  for (const [playerId, group] of assignmentEntries) {
    const groupValid =
      Number.isInteger(group) &&
      group >= 1 &&
      (group <= MAX_TOURNAMENT_GROUPS || customGroupNumbers.has(group));
    if (!rosterIds.has(playerId) || !groupValid) {
      return { error: "Некоректні дані розіграшу" };
    }
  }

  let playoffGroups: [number, number] | null = null;
  if (withPlayoff) {
    const eligibility = validateGroupPlayoffEligibility(matchups);
    if (!eligibility.ok) return { error: eligibility.error };
    playoffGroups = eligibility.groups;
  }

  const rows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));

  // See commitGroups12PlayoffAction (randomize-singles-groups12.ts) for the
  // same pattern: playerless placeholder matches + MatchAdvancement rows,
  // resolved automatically once the group stage (and each playoff round)
  // completes (src/lib/bracket-advancement.ts). Bracket-relative group "1"
  // maps to whichever real group number is numerically lower of the 2 in
  // play (see validateGroupPlayoffEligibility) - not necessarily literal
  // group 1, since an admin picking among pre-existing groups could have
  // e.g. 3 and 5 in play instead.
  const bracketRows = playoffGroups
    ? DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.map((plan) => ({ id: randomUUID(), plan }))
    : [];
  const bracketIdByKey = new Map(bracketRows.map(({ id, plan }) => [plan.key, id]));
  const resolveBracketGroup = (bracketGroup: number): number =>
    bracketGroup === 1 ? playoffGroups![0] : playoffGroups![1];

  function toAdvancementFields(source: BracketSlotSource) {
    if (source.kind === "GROUP_RANK") {
      return {
        source: "GROUP_RANK" as const,
        sourceGroup: resolveBracketGroup(source.group),
        sourceRank: source.rank,
      };
    }
    return {
      source: "MATCH_RESULT" as const,
      sourceMatchId: bracketIdByKey.get(source.sourceMatchKey)!,
      outcome: source.outcome,
    };
  }

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
        matchType: "DOUBLES",
        scheduledDate: tournament.startDate,
        round: resolveGroupLabel(matchup.group, customGroupNames),
      })),
    });
    await tx.matchPlayer.createMany({
      data: rows.flatMap(({ id, matchup }) => [
        ...matchup.sideAIds.map((playerId) => ({ matchId: id, side: "A" as const, playerId })),
        ...matchup.sideBIds.map((playerId) => ({ matchId: id, side: "B" as const, playerId })),
      ]),
    });

    if (bracketRows.length > 0) {
      await tx.match.createMany({
        data: bracketRows.map(({ id, plan }) => ({
          id,
          tournamentId,
          matchType: "DOUBLES" as const,
          // Same staggered-scheduledDate trick as commitGroups12PlayoffAction
          // - keeps the "Матчі" tab's date-then-createdAt sort in
          // PLAYOFF_DISPLAY_ORDER's order despite every bracket row sharing
          // one createMany's DB-assigned createdAt.
          scheduledDate: new Date(
            tournament.startDate.getTime() + (PLAYOFF_DISPLAY_ORDER.indexOf(plan.round) + 1) * 1000,
          ),
          round: plan.round,
        })),
      });
      await tx.matchAdvancement.createMany({
        data: bracketRows.flatMap(({ id, plan }) => [
          { tournamentId, matchId: id, side: "A" as const, ...toAdvancementFields(plan.sideA) },
          { tournamentId, matchId: id, side: "B" as const, ...toAdvancementFields(plan.sideB) },
        ]),
      });
    }
  });

  const matchCount = rows.length + bracketRows.length;

  after(() => logAudit(session.user, {
    action: "match.randomize",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Рандомайзер (парний, за групами${withPlayoff ? " + плей-офф" : ""}): згенеровано ${matchCount} матч(ів)`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true, matchCount };
}
