"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { determineMatchWinner } from "@/lib/match-result";
import { requireAdmin } from "@/lib/permissions";
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
