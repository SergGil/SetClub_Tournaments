"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { checkPadelCompletedMatchesAcknowledged } from "@/lib/actions/padel-match-randomize-shared";
import type { CommitState, NamedPlayer } from "@/lib/actions/padel-match-randomize-shared";
import type { NamedGroup, NamedSinglesMatchup } from "@/lib/actions/padel-randomize-singles";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { BracketSlotSource } from "@/lib/groups12-playoff-bracket";
import { GROUPS12_PLAYOFF_BRACKET_PLAN } from "@/lib/groups12-playoff-bracket";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";
import { requireDomainAdmin } from "@/lib/permissions";
import { fullDisplayName } from "@/lib/player-display";
import { PLAYOFF_DISPLAY_ORDER } from "@/lib/playoff-rounds";
import { buildGroups12PlayoffDraw, groupRoundLabel } from "@/lib/randomize-pairs";
import { schedulePadelRatingSnapshotRefresh } from "@/lib/rating/padel-snapshot";

const REQUIRED_PARTICIPANT_COUNT = 12;
const REQUIRED_SEEDED_COUNT = 4;
const ELIGIBILITY_ERROR = "Потрібно рівно 12 учасників і рівно 4 сіяних";

export type Groups12PlayoffDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      existingGroups: NamedGroup[];
      groupAssignment: Record<string, number>;
      revealOrder: NamedPlayer[];
      matchups: NamedSinglesMatchup[];
    };

/** Padel twin of drawGroups12PlayoffAction - see its doc comment for the full rationale. */
export async function drawPadelGroups12PlayoffAction(tournamentId: string): Promise<Groups12PlayoffDrawState> {
  await requireDomainAdmin("PADEL");

  const tournament = await prisma.padelTournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (!tournament) return { ok: false, error: "Турнір не знайдено" };
  if (tournament.format !== "SINGLES") {
    return { ok: false, error: "Рандомайзер доступний лише для одиночних турнірів" };
  }

  const participants = await prisma.padelTournamentParticipant.findMany({
    where: { tournamentId, withdrawnAt: null },
    select: { playerId: true, seed: true, player: { select: { name: true, nickname: true } } },
  });
  const seededCount = participants.filter((p) => p.seed !== null).length;
  if (participants.length !== REQUIRED_PARTICIPANT_COUNT || seededCount !== REQUIRED_SEEDED_COUNT) {
    return { ok: false, error: ELIGIBILITY_ERROR };
  }

  const nameById = new Map(participants.map((p) => [p.playerId, fullDisplayName(p.player)]));
  const named = (playerId: string): NamedPlayer => ({ playerId, name: nameById.get(playerId) ?? "?" });

  const { groupAssignment, matchups } = buildGroups12PlayoffDraw(
    participants.map((p) => ({ playerId: p.playerId, seeded: p.seed !== null })),
  );

  return {
    ok: true,
    existingGroups: [1, 2, 3, 4].map((group) => ({ group, players: [] })),
    groupAssignment: Object.fromEntries(groupAssignment),
    revealOrder: [...groupAssignment.keys()].map(named),
    matchups: matchups.map((m) => ({
      sideA: named(m.sideA),
      sideB: named(m.sideB),
      round: groupRoundLabel(m.group),
    })),
  };
}

/** Padel twin of commitGroups12PlayoffAction - see its doc comment for the full 30-match bracket topology rationale. */
export async function commitPadelGroups12PlayoffAction(
  tournamentId: string,
  groupAssignment: Record<string, number>,
  matchups: { sideA: string; sideB: string; round: string }[],
  acknowledgedCompletedLoss: boolean,
): Promise<CommitState> {
  const session = await requireDomainAdmin("PADEL");

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
  const seededCount = participants.filter((p) => p.seed !== null).length;
  if (participants.length !== REQUIRED_PARTICIPANT_COUNT || seededCount !== REQUIRED_SEEDED_COUNT) {
    return { error: ELIGIBILITY_ERROR };
  }
  const rosterIds = new Set(participants.map((p) => p.playerId));

  if (!Array.isArray(matchups) || matchups.length !== 12) {
    return { error: "Некоректні дані розіграшу" };
  }
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
  if (assignmentEntries.length !== REQUIRED_PARTICIPANT_COUNT) {
    return { error: "Некоректні дані розіграшу" };
  }
  for (const [playerId, group] of assignmentEntries) {
    if (!rosterIds.has(playerId) || !Number.isInteger(group) || group < 1 || group > 4) {
      return { error: "Некоректні дані розіграшу" };
    }
  }

  const groupRows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));
  const bracketRows = GROUPS12_PLAYOFF_BRACKET_PLAN.map((plan) => ({ id: randomUUID(), plan }));
  const bracketIdByKey = new Map(bracketRows.map(({ id, plan }) => [plan.key, id]));

  function toAdvancementFields(source: BracketSlotSource) {
    if (source.kind === "GROUP_RANK") {
      return { source: "GROUP_RANK" as const, sourceGroup: source.group, sourceRank: source.rank };
    }
    return {
      source: "MATCH_RESULT" as const,
      sourceMatchId: bracketIdByKey.get(source.sourceMatchKey)!,
      outcome: source.outcome,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 1)`;
    await Promise.all(
      assignmentEntries.map(([playerId, group]) =>
        tx.padelTournamentParticipant.update({
          where: { tournamentId_playerId: { tournamentId, playerId } },
          data: { group },
        }),
      ),
    );

    await tx.padelMatch.deleteMany({ where: { tournamentId } });

    await tx.padelMatch.createMany({
      data: groupRows.map(({ id, matchup }) => ({
        id,
        tournamentId,
        matchType: "SINGLES",
        scheduledDate: tournament.startDate,
        round: matchup.round,
      })),
    });
    await tx.padelMatchPlayer.createMany({
      data: groupRows.flatMap(({ id, matchup }) => [
        { matchId: id, side: "A" as const, playerId: matchup.sideA },
        { matchId: id, side: "B" as const, playerId: matchup.sideB },
      ]),
    });

    await tx.padelMatch.createMany({
      data: bracketRows.map(({ id, plan }) => ({
        id,
        tournamentId,
        matchType: "SINGLES" as const,
        round: plan.round,
        scheduledDate: new Date(
          tournament.startDate.getTime() + (PLAYOFF_DISPLAY_ORDER.indexOf(plan.round) + 1) * 1000,
        ),
      })),
    });
    await tx.padelMatchAdvancement.createMany({
      data: bracketRows.flatMap(({ id, plan }) => [
        { tournamentId, matchId: id, side: "A" as const, ...toAdvancementFields(plan.sideA) },
        { tournamentId, matchId: id, side: "B" as const, ...toAdvancementFields(plan.sideB) },
      ]),
    });
  });

  const matchCount = groupRows.length + bracketRows.length;

  after(() => logAudit(session.user, {
    action: "padel.match.randomize",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Рандомайзер (Падел, одиночний, GROUPS_12_PLAYOFF): згенеровано ${matchCount} матч(ів)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true, matchCount };
}
