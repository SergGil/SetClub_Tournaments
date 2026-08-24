"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { checkPadelCompletedMatchesAcknowledged } from "@/lib/actions/padel-match-randomize-shared";
import type { CommitState, NamedPlayer } from "@/lib/actions/padel-match-randomize-shared";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";
import { requireDomainAdmin } from "@/lib/permissions";
import { fullDisplayName } from "@/lib/player-display";
import {
  assignUngroupedDoublesToGroups,
  buildCustomGroupsDoublesRoundRobin,
  buildRandomDoublesPairing,
  MAX_TOURNAMENT_GROUPS,
  resolveGroupLabel,
  shuffle,
} from "@/lib/randomize-pairs";
import type { Team } from "@/lib/randomize-pairs";
import { schedulePadelRatingSnapshotRefresh } from "@/lib/rating/padel-snapshot";

export type NamedTeam = { playerIds: [string, string]; names: [string, string] };
export type NamedMatchup = { sideA: NamedTeam; sideB: NamedTeam };

/** Padel twin of validateFixedPairs from randomize-doubles.ts. */
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

/** Padel twin of drawDoublesTeamsAction. */
export async function drawPadelDoublesTeamsAction(
  tournamentId: string,
  fixedPairs: [string, string][] = [],
): Promise<DrawState> {
  await requireDomainAdmin("PADEL");

  const tournament = await prisma.padelTournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (!tournament) return { ok: false, error: "Турнір не знайдено" };
  if (tournament.format !== "DOUBLES") {
    return { ok: false, error: "Рандомайзер доступний лише для парних турнірів" };
  }

  const participants = await prisma.padelTournamentParticipant.findMany({
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
    seededBasket: withNames(shuffle(seededOrder)),
    unseededBasket: withNames(shuffle(unseededOrder)),
    randomTeams: randomTeams.map(teamWithNames),
    matchups: matchups.map((m) => ({ sideA: teamWithNames(m.sideA), sideB: teamWithNames(m.sideB) })),
    unpairedNames: unpaired.map((playerId) => nameById.get(playerId) ?? "?"),
  };
}

/** Padel twin of commitDoublesMatchesAction. */
export async function commitPadelDoublesMatchesAction(
  tournamentId: string,
  matchups: { sideAIds: [string, string]; sideBIds: [string, string] }[],
  acknowledgedCompletedLoss: boolean,
): Promise<CommitState> {
  const session = await requireDomainAdmin("PADEL");

  const tournament = await prisma.padelTournament.findUnique({
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

  const completedError = await checkPadelCompletedMatchesAcknowledged(tournamentId, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const participants = await prisma.padelTournamentParticipant.findMany({
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

  const rows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 1)`;
    await tx.padelMatch.deleteMany({ where: { tournamentId } });
    await tx.padelMatch.createMany({
      data: rows.map(({ id }) => ({
        id,
        tournamentId,
        matchType: "DOUBLES",
        scheduledDate: tournament.startDate,
      })),
    });
    await tx.padelMatchPlayer.createMany({
      data: rows.flatMap(({ id, matchup }) => [
        ...matchup.sideAIds.map((playerId) => ({ matchId: id, side: "A" as const, playerId })),
        ...matchup.sideBIds.map((playerId) => ({ matchId: id, side: "B" as const, playerId })),
      ]),
    });
  });

  after(() => logAudit(session.user, {
    action: "padel.match.randomize",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Рандомайзер (Падел, парний): згенеровано ${matchups.length} матч(ів)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true, matchCount: matchups.length };
}

export type NamedGroupedTeam = { playerIds: [string, string]; names: [string, string]; group: number };
export type NamedGroupedMatchup = { sideA: NamedGroupedTeam; sideB: NamedGroupedTeam; group: number };

export type DoublesGroupDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      groups: number[];
      fixedTeams: NamedGroupedTeam[];
      randomTeams: NamedGroupedTeam[];
      groupAssignment: Record<string, number>;
      matchups: NamedGroupedMatchup[];
      unpairedNames: string[];
    };

/**
 * Padel twin of drawDoublesGroupsAction. `groupCount` lets the admin split a
 * roster with no pre-assigned groups into that many fresh random groups in
 * one step - it's only consulted when nobody already has a group (an
 * existing roster split always wins).
 */
export async function drawPadelDoublesGroupsAction(
  tournamentId: string,
  fixedPairs: [string, string][] = [],
  groupCount?: number,
): Promise<DoublesGroupDrawState> {
  await requireDomainAdmin("PADEL");

  const tournament = await prisma.padelTournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (!tournament) return { ok: false, error: "Турнір не знайдено" };
  if (tournament.format !== "DOUBLES") {
    return { ok: false, error: "Рандомайзер доступний лише для парних турнірів" };
  }

  const participants = await prisma.padelTournamentParticipant.findMany({
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
    participants.map((p) => ({ playerId: p.playerId, group: p.group })),
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

/** Padel twin of commitDoublesGroupsAction. */
export async function commitPadelDoublesGroupsAction(
  tournamentId: string,
  groupAssignment: Record<string, number>,
  matchups: { sideAIds: [string, string]; sideBIds: [string, string]; group: number }[],
  acknowledgedCompletedLoss: boolean,
): Promise<CommitState> {
  const session = await requireDomainAdmin("PADEL");

  const tournament = await prisma.padelTournament.findUnique({
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

  const completedError = await checkPadelCompletedMatchesAcknowledged(tournamentId, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const [participants, customGroups] = await Promise.all([
    prisma.padelTournamentParticipant.findMany({ where: { tournamentId }, select: { playerId: true } }),
    prisma.padelTournamentGroup.findMany({ where: { tournamentId }, select: { number: true, name: true } }),
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

  const rows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 1)`;
    if (assignmentEntries.length > 0) {
      await Promise.all(
        assignmentEntries.map(([playerId, group]) =>
          tx.padelTournamentParticipant.update({
            where: { tournamentId_playerId: { tournamentId, playerId } },
            data: { group },
          }),
        ),
      );
    }
    await tx.padelMatch.deleteMany({ where: { tournamentId } });
    await tx.padelMatch.createMany({
      data: rows.map(({ id, matchup }) => ({
        id,
        tournamentId,
        matchType: "DOUBLES",
        scheduledDate: tournament.startDate,
        round: resolveGroupLabel(matchup.group, customGroupNames),
      })),
    });
    await tx.padelMatchPlayer.createMany({
      data: rows.flatMap(({ id, matchup }) => [
        ...matchup.sideAIds.map((playerId) => ({ matchId: id, side: "A" as const, playerId })),
        ...matchup.sideBIds.map((playerId) => ({ matchId: id, side: "B" as const, playerId })),
      ]),
    });
  });

  after(() => logAudit(session.user, {
    action: "padel.match.randomize",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Рандомайзер (Падел, парний, за групами): згенеровано ${matchups.length} матч(ів)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true, matchCount: matchups.length };
}
