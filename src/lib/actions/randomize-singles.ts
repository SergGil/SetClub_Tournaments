"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { checkCompletedMatchesAcknowledged } from "@/lib/actions/match-randomize-shared";
import type { CommitState, NamedPlayer } from "@/lib/actions/match-randomize-shared";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { fullDisplayName } from "@/lib/player-display";
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
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";

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
  acknowledgedCompletedLoss: boolean,
): Promise<CommitState> {
  const session = await requireDomainAdmin("TENNIS");

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true, startDate: true },
  });
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "SINGLES") {
    return { error: "Рандомайзер доступний лише для одиночних турнірів" };
  }

  const completedError = await checkCompletedMatchesAcknowledged(tournamentId, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const participants = await prisma.tournamentParticipant.findMany({
    // A withdrawn player (see withdrawParticipantAction) is excluded from
    // every new draw - they're done for this tournament, not a candidate
    // for fresh matches.
    where: { tournamentId, withdrawnAt: null },
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

  // Same bulk-createMany approach as the doubles randomizer, and for the
  // same reason: a round robin over a real roster is dozens of matches, too
  // many nested-create round trips to fit one interactive transaction's 5s
  // timeout against a remote database.
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
  await requireDomainAdmin("TENNIS");

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (!tournament) return { ok: false, error: "Турнір не знайдено" };
  if (tournament.format !== "SINGLES") {
    return { ok: false, error: "Рандомайзер доступний лише для одиночних турнірів" };
  }

  const [participants, customGroups] = await Promise.all([
    prisma.tournamentParticipant.findMany({
      // Same withdrawal exclusion as commitSinglesRoundRobinAction above.
      where: { tournamentId, withdrawnAt: null },
      select: { playerId: true, group: true, player: { select: { name: true, nickname: true } } },
    }),
    prisma.tournamentGroup.findMany({ where: { tournamentId }, select: { number: true, name: true } }),
  ]);
  if (participants.length < 2) {
    return { ok: false, error: "Потрібно щонайменше 2 учасники" };
  }
  if (!participants.some((p) => p.group !== null)) {
    return { ok: false, error: "Призначте бодай одному гравцю групу вручну в ростері" };
  }
  const customGroupNames = new Map(customGroups.map((g) => [g.number, g.name]));

  // fullDisplayName ("Name (Nickname)") - this feeds the randomizer's draw
  // preview, an admin picker where mixing up a player matters (see
  // docs/PLAYER_NICKNAME.md).
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

/**
 * Persists an exact draw previously returned by drawSinglesGroupsAction:
 * assigns any newly-drawn players' groups on the roster, then replaces the
 * tournament's matches, both in one transaction.
 */
export async function commitSinglesGroupsAction(
  tournamentId: string,
  groupAssignment: Record<string, number>,
  matchups: { sideA: string; sideB: string; round: string }[],
  acknowledgedCompletedLoss: boolean,
): Promise<CommitState> {
  const session = await requireDomainAdmin("TENNIS");

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

  const completedError = await checkCompletedMatchesAcknowledged(tournamentId, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const [participants, customGroups] = await Promise.all([
    // Same withdrawal exclusion as drawSinglesGroupsAction/commitSinglesRoundRobinAction:
    // this action trusts the client-submitted matchups/groupAssignment rather
    // than recomputing the draw server-side, so without this filter a
    // withdrawal that happens between opening the draw preview and clicking
    // "commit" wouldn't be caught here.
    prisma.tournamentParticipant.findMany({
      where: { tournamentId, withdrawnAt: null },
      select: { playerId: true },
    }),
    prisma.tournamentGroup.findMany({ where: { tournamentId }, select: { number: true } }),
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
