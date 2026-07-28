"use server";

import { revalidatePath, updateTag } from "next/cache";

import { prisma } from "@/lib/db";
import { determineMatchWinner } from "@/lib/match-result";
import { requireAdmin } from "@/lib/permissions";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import { buildRandomDoublesPairing, buildSinglesRoundRobin } from "@/lib/randomize-pairs";
import type { Team } from "@/lib/randomize-pairs";
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
          ...(playersChanged ? { status: "SCHEDULED" as const, winnerSide: null } : {}),
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

  const parsed = scoreFormSchema.safeParse({ matchId: formData.get("matchId"), sets: rawSets });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректний рахунок" };
  }

  const winnerSide = determineMatchWinner(parsed.data.sets);
  if (parsed.data.sets.length > 0 && !winnerSide) {
    return { error: "Неможливо визначити переможця — рахунок сетів рівний" };
  }

  const [, , updatedMatch] = await prisma.$transaction([
    prisma.matchSet.deleteMany({ where: { matchId: parsed.data.matchId } }),
    prisma.matchSet.createMany({
      data: parsed.data.sets.map((set, index) => ({
        matchId: parsed.data.matchId,
        setNumber: index + 1,
        sideAGames: set.sideAGames,
        sideBGames: set.sideBGames,
      })),
    }),
    prisma.match.update({
      where: { id: parsed.data.matchId },
      data: {
        status: winnerSide ? "COMPLETED" : "SCHEDULED",
        winnerSide,
      },
    }),
  ]);

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
      seededBasket: NamedPlayer[];
      unseededBasket: NamedPlayer[];
      teams: NamedTeam[];
      matchups: NamedMatchup[];
      unpairedNames: string[];
    };

/**
 * Computes (but does not persist) a random doubles draw: teams pairing one
 * "seeded" with one "unseeded" player where possible, then a round-robin of
 * every team against every other. Read-only, so the UI can animate the draw
 * before the admin commits it via commitDoublesMatchesAction.
 */
export async function drawDoublesTeamsAction(tournamentId: string): Promise<DrawState> {
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

  const nameById = new Map(participants.map((p) => [p.playerId, p.player.name]));
  const { seededOrder, unseededOrder, teams, matchups, unpaired } = buildRandomDoublesPairing(
    participants.map((p) => ({ playerId: p.playerId, seeded: p.seed !== null })),
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
    seededBasket: withNames(seededOrder),
    unseededBasket: withNames(unseededOrder),
    teams: teams.map(teamWithNames),
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

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { tournamentId } }),
    ...matchups.map((matchup) =>
      prisma.match.create({
        data: {
          tournamentId,
          matchType: "DOUBLES",
          scheduledDate: tournament.startDate,
          players: {
            create: [
              ...matchup.sideAIds.map((playerId) => ({ side: "A" as const, playerId })),
              ...matchup.sideBIds.map((playerId) => ({ side: "B" as const, playerId })),
            ],
          },
        },
      }),
    ),
  ]);

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  return { success: true, matchCount: matchups.length };
}

/**
 * Generates and persists a full round robin for a SINGLES tournament's
 * roster (every participant plays every other once). Like the doubles
 * randomizer, re-running it ("Рерандомайзер") replaces any existing
 * matches rather than piling duplicates on top.
 */
export async function commitSinglesRoundRobinAction(tournamentId: string): Promise<CommitState> {
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
    select: { playerId: true },
  });
  if (participants.length < 2) {
    return { error: "Потрібно щонайменше 2 учасники" };
  }

  const matchups = buildSinglesRoundRobin(participants.map((p) => p.playerId));

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { tournamentId } }),
    ...matchups.map((matchup) =>
      prisma.match.create({
        data: {
          tournamentId,
          matchType: "SINGLES",
          scheduledDate: tournament.startDate,
          players: {
            create: [
              { side: "A" as const, playerId: matchup.sideA },
              { side: "B" as const, playerId: matchup.sideB },
            ],
          },
        },
      }),
    ),
  ]);

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  return { success: true, matchCount: matchups.length };
}
