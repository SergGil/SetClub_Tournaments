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
// Pure combinatorics (no Prisma coupling) - reused as-is, same algorithm Tennis uses.
import {
  assignUngroupedToGroups,
  buildCustomGroupsSinglesRoundRobin,
  buildSeededSinglesRoundRobin,
  buildSinglesRoundRobin,
  MAX_TOURNAMENT_GROUPS,
  resolveGroupLabel,
  SINGLES_GROUP_LABEL,
} from "@/lib/randomize-pairs";
import type { SinglesRandomizeStrategy } from "@/lib/randomize-pairs";
import { schedulePadelRatingSnapshotRefresh } from "@/lib/rating/padel-snapshot";

/** Padel twin of commitSinglesRoundRobinAction - see its doc comment for the full rationale (ALL / SEEDED_SPLIT strategies). */
export async function commitPadelSinglesRoundRobinAction(
  tournamentId: string,
  strategy: Exclude<SinglesRandomizeStrategy, "CUSTOM_GROUPS">,
  acknowledgedCompletedLoss: boolean,
  request?: Request,
): Promise<CommitState> {
  const session = await requireDomainAdmin("PADEL", request);

  const tournament = await prisma.padelTournament.findUnique({
    where: { id: tournamentId },
    select: { format: true, startDate: true },
  });
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "SINGLES") {
    return { error: "Рандомайзер доступний лише для одиночних турнірів" };
  }

  const completedError = await checkPadelCompletedMatchesAcknowledged(tournamentId, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const participants = await prisma.padelTournamentParticipant.findMany({
    where: { tournamentId, withdrawnAt: null },
    select: { playerId: true, seed: true },
  });
  if (participants.length < 2) {
    return { error: "Потрібно щонайменше 2 учасники" };
  }

  if (strategy === "SEEDED_SPLIT") {
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

  const rows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 1)`;
    await tx.padelMatch.deleteMany({ where: { tournamentId } });
    await tx.padelMatch.createMany({
      data: rows.map(({ id, matchup }) => ({
        id,
        tournamentId,
        matchType: "SINGLES",
        scheduledDate: tournament.startDate,
        round: matchup.round,
      })),
    });
    await tx.padelMatchPlayer.createMany({
      data: rows.flatMap(({ id, matchup }) => [
        { matchId: id, side: "A" as const, playerId: matchup.sideA },
        { matchId: id, side: "B" as const, playerId: matchup.sideB },
      ]),
    });
  });

  after(() => logAudit(session.user, {
    action: "padel.match.randomize",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Рандомайзер (Падел, одиночний, ${strategy}): згенеровано ${matchups.length} матч(ів)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true, matchCount: matchups.length };
}

export type NamedGroup = { group: number; players: NamedPlayer[] };
export type NamedSinglesMatchup = { sideA: NamedPlayer; sideB: NamedPlayer; round: string };

export type SinglesGroupDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      existingGroups: NamedGroup[];
      revealOrder: NamedPlayer[];
      groupAssignment: Record<string, number>;
      matchups: NamedSinglesMatchup[];
    };

/** Padel twin of drawSinglesGroupsAction. */
export async function drawPadelSinglesGroupsAction(tournamentId: string, request?: Request): Promise<SinglesGroupDrawState> {
  await requireDomainAdmin("PADEL", request);

  const tournament = await prisma.padelTournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (!tournament) return { ok: false, error: "Турнір не знайдено" };
  if (tournament.format !== "SINGLES") {
    return { ok: false, error: "Рандомайзер доступний лише для одиночних турнірів" };
  }

  const [participants, customGroups] = await Promise.all([
    prisma.padelTournamentParticipant.findMany({
      where: { tournamentId, withdrawnAt: null },
      select: { playerId: true, group: true, player: { select: { name: true, nickname: true } } },
    }),
    prisma.padelTournamentGroup.findMany({ where: { tournamentId }, select: { number: true, name: true } }),
  ]);
  if (participants.length < 2) {
    return { ok: false, error: "Потрібно щонайменше 2 учасники" };
  }
  if (!participants.some((p) => p.group !== null)) {
    return { ok: false, error: "Призначте бодай одному гравцю групу вручну в ростері" };
  }
  const customGroupNames = new Map(customGroups.map((g) => [g.number, g.name]));

  const nameById = new Map(participants.map((p) => [p.playerId, fullDisplayName(p.player)]));
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
    (m) => ({ sideA: named(m.sideA), sideB: named(m.sideB), round: resolveGroupLabel(m.group, customGroupNames) }),
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

/** Padel twin of commitSinglesGroupsAction. */
export async function commitPadelSinglesGroupsAction(
  tournamentId: string,
  groupAssignment: Record<string, number>,
  matchups: { sideA: string; sideB: string; round: string }[],
  acknowledgedCompletedLoss: boolean,
  request?: Request,
): Promise<CommitState> {
  const session = await requireDomainAdmin("PADEL", request);

  const tournament = await prisma.padelTournament.findUnique({
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

  const completedError = await checkPadelCompletedMatchesAcknowledged(tournamentId, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const [participants, customGroups] = await Promise.all([
    prisma.padelTournamentParticipant.findMany({
      where: { tournamentId, withdrawnAt: null },
      select: { playerId: true },
    }),
    prisma.padelTournamentGroup.findMany({ where: { tournamentId }, select: { number: true } }),
  ]);
  const rosterIds = new Set(participants.map((p) => p.playerId));
  const customGroupNumbers = new Set(customGroups.map((g) => g.number));

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
        matchType: "SINGLES",
        scheduledDate: tournament.startDate,
        round: matchup.round,
      })),
    });
    await tx.padelMatchPlayer.createMany({
      data: rows.flatMap(({ id, matchup }) => [
        { matchId: id, side: "A" as const, playerId: matchup.sideA },
        { matchId: id, side: "B" as const, playerId: matchup.sideB },
      ]),
    });
  });

  after(() => logAudit(session.user, {
    action: "padel.match.randomize",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Рандомайзер (Падел, одиночний, CUSTOM_GROUPS): згенеровано ${matchups.length} матч(ів)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true, matchCount: matchups.length };
}
