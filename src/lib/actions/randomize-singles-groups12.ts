"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { checkCompletedMatchesAcknowledged } from "@/lib/actions/match-randomize-shared";
import type { CommitState, NamedPlayer } from "@/lib/actions/match-randomize-shared";
import type { NamedGroup, NamedSinglesMatchup } from "@/lib/actions/randomize-singles";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { BracketSlotSource } from "@/lib/groups12-playoff-bracket";
import { GROUPS12_PLAYOFF_BRACKET_PLAN } from "@/lib/groups12-playoff-bracket";
import { requireAdmin } from "@/lib/permissions";
import { fullDisplayName } from "@/lib/player-display";
import { PLAYOFF_DISPLAY_ORDER } from "@/lib/playoff-rounds";
import { buildGroups12PlayoffDraw, groupRoundLabel } from "@/lib/randomize-pairs";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";

const REQUIRED_PARTICIPANT_COUNT = 12;
const REQUIRED_SEEDED_COUNT = 4;
const ELIGIBILITY_ERROR = "Потрібно рівно 12 учасників і рівно 4 сіяних";

export type Groups12PlayoffDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Always the 4 empty A-D baskets (this format never has a pre-existing group to show) - kept so the draw-animation UI can share its rendering with the CUSTOM_GROUPS strategy's draw state. */
      existingGroups: NamedGroup[];
      groupAssignment: Record<string, number>;
      revealOrder: NamedPlayer[];
      matchups: NamedSinglesMatchup[];
    };

/**
 * Computes (but does not persist) a "GROUPS_12_PLAYOFF" draw - see
 * docs/GROUPS12_PLAYOFF.md. Always a fresh full draw of all 12 participants
 * (unlike drawSinglesGroupsAction, there's no partial "deal the ungrouped
 * remainder into existing groups" step: this format's exactly-1-seed-per-
 * group shape can't generally be satisfied by extending a prior assignment).
 */
export async function drawGroups12PlayoffAction(tournamentId: string): Promise<Groups12PlayoffDrawState> {
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
    // A withdrawn player (see withdrawParticipantAction) is never a draw
    // candidate - and since this format needs an exact headcount, a
    // withdrawal correctly makes re-drawing ineligible until the roster is
    // back to 12 active (non-withdrawn) participants.
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

/**
 * Persists an exact draw previously returned by drawGroups12PlayoffAction:
 * assigns each player's built-in group, creates the 12 real group-stage
 * matches, and pre-creates all 18 downstream playoff/placement/mini-group
 * matches as empty placeholders wired up via MatchAdvancement - see
 * docs/GROUPS12_PLAYOFF.md for the full bracket topology. Replaces the
 * tournament's matches wholesale, same as every other randomizer commit.
 */
export async function commitGroups12PlayoffAction(
  tournamentId: string,
  groupAssignment: Record<string, number>,
  matchups: { sideA: string; sideB: string; round: string }[],
  acknowledgedCompletedLoss: boolean,
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

  const completedError = await checkCompletedMatchesAcknowledged(tournamentId, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const participants = await prisma.tournamentParticipant.findMany({
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
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 0)`;
    await Promise.all(
      assignmentEntries.map(([playerId, group]) =>
        tx.tournamentParticipant.update({
          where: { tournamentId_playerId: { tournamentId, playerId } },
          data: { group },
        }),
      ),
    );

    await tx.match.deleteMany({ where: { tournamentId } });

    await tx.match.createMany({
      data: groupRows.map(({ id, matchup }) => ({
        id,
        tournamentId,
        matchType: "SINGLES",
        scheduledDate: tournament.startDate,
        round: matchup.round,
      })),
    });
    await tx.matchPlayer.createMany({
      data: groupRows.flatMap(({ id, matchup }) => [
        { matchId: id, side: "A" as const, playerId: matchup.sideA },
        { matchId: id, side: "B" as const, playerId: matchup.sideB },
      ]),
    });

    await tx.match.createMany({
      data: bracketRows.map(({ id, plan }) => ({
        id,
        tournamentId,
        matchType: "SINGLES" as const,
        round: plan.round,
        // getTournamentMatches (the flat "Матчі" tab's query) sorts
        // uncompleted matches by scheduledDate ASC, then createdAt ASC -
        // Postgres doesn't guarantee createdAt reflects insertion order for
        // rows sharing one createMany statement's timestamp, so stagger by a
        // few seconds in PLAYOFF_DISPLAY_ORDER's own order (Фінал earliest,
        // MINI_GROUP_ROUND latest) so e.g. "Втішний півфінал" reliably lands
        // above "За 5/7 місце" regardless of that tie-break. Same day as the
        // tournament (seconds, not days), so the displayed date
        // (formatDateUTC drops time-of-day) never changes. `+ 1` keeps every
        // bracket row strictly after the group-stage rows above, which all
        // share tournament.startDate exactly (offset 0) - without it,
        // PLAYOFF_DISPLAY_ORDER[0] (Фінал) would tie with every group match
        // and could sort anywhere among them instead of reliably last.
        scheduledDate: new Date(
          tournament.startDate.getTime() + (PLAYOFF_DISPLAY_ORDER.indexOf(plan.round) + 1) * 1000,
        ),
      })),
    });
    await tx.matchAdvancement.createMany({
      data: bracketRows.flatMap(({ id, plan }) => [
        { tournamentId, matchId: id, side: "A" as const, ...toAdvancementFields(plan.sideA) },
        { tournamentId, matchId: id, side: "B" as const, ...toAdvancementFields(plan.sideB) },
      ]),
    });
  });

  const matchCount = groupRows.length + bracketRows.length;

  after(() => logAudit(session.user, {
    action: "match.randomize",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Рандомайзер (одиночний, GROUPS_12_PLAYOFF): згенеровано ${matchCount} матч(ів)`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true, matchCount };
}
