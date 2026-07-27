"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { determineMatchWinner } from "@/lib/match-result";
import { requireAdmin } from "@/lib/permissions";
import { buildRandomDoublesPairing } from "@/lib/randomize-pairs";
import { matchFormSchema, scoreFormSchema } from "@/lib/validation/match";

export type ActionState = { error?: string; success?: boolean };
export type RandomizeState = { error?: string; success?: boolean; matchCount?: number; unpairedCount?: number };

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

/**
 * Randomly draws doubles teams from the tournament roster (pairing one
 * "seeded" player with one "unseeded" player where possible), randomly
 * matches those teams against each other, and creates a DOUBLES match per
 * matchup.
 */
export async function randomizePairsAction(tournamentId: string): Promise<RandomizeState> {
  await requireAdmin();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "DOUBLES") {
    return { error: "Рандомайзер доступний лише для парних турнірів" };
  }

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { playerId: true, seed: true },
  });
  if (participants.length < 4) {
    return { error: "Потрібно щонайменше 4 учасники для парного розіграшу" };
  }
  if (!participants.some((p) => p.seed !== null)) {
    return { error: "Позначте хоча б одного гравця як сеяного" };
  }

  const { matchups, unpaired } = buildRandomDoublesPairing(
    participants.map((p) => ({ playerId: p.playerId, seeded: p.seed !== null })),
  );
  if (matchups.length === 0) {
    return { error: "Не вдалося сформувати жодної пари" };
  }

  await prisma.$transaction(
    matchups.map((matchup) =>
      prisma.match.create({
        data: {
          tournamentId,
          matchType: "DOUBLES",
          players: {
            create: [
              ...matchup.sideA.playerIds.map((playerId) => ({ side: "A" as const, playerId })),
              ...matchup.sideB.playerIds.map((playerId) => ({ side: "B" as const, playerId })),
            ],
          },
        },
      }),
    ),
  );

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true, matchCount: matchups.length, unpairedCount: unpaired.length };
}
