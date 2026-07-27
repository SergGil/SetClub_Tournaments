"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { determineMatchWinner } from "@/lib/match-result";
import { requireAdmin } from "@/lib/permissions";
import { buildRandomDoublesPairing } from "@/lib/randomize-pairs";
import type { Team } from "@/lib/randomize-pairs";
import { matchFormSchema, scoreFormSchema } from "@/lib/validation/match";

export type ActionState = { error?: string; success?: boolean };

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
  return { success: true };
}

export async function deleteMatchAction(matchId: string, tournamentId: string): Promise<void> {
  await requireAdmin();
  await prisma.match.delete({ where: { id: matchId } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function saveScoreAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const tournamentId = formData.get("tournamentId");
  if (typeof tournamentId !== "string" || !tournamentId) {
    return { error: "Турнір не знайдено" };
  }

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

  await prisma.$transaction([
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

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
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
    return { ok: false, error: "Позначте хоча б одного гравця як сеяного" };
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
    select: { format: true },
  });
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "DOUBLES") {
    return { error: "Рандомайзер доступний лише для парних турнірів" };
  }
  if (matchups.length === 0) {
    return { error: "Немає матчів для створення" };
  }

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { tournamentId } }),
    ...matchups.map((matchup) =>
      prisma.match.create({
        data: {
          tournamentId,
          matchType: "DOUBLES",
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
  return { success: true, matchCount: matchups.length };
}
