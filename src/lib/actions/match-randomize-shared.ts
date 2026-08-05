"use server";

import { prisma } from "@/lib/db";

export type NamedPlayer = { playerId: string; name: string };
export type CommitState = { error?: string; success?: boolean; matchCount?: number };

/**
 * Re-running a randomizer ("Рерандомайзер") deletes every existing match in
 * the tournament, including COMPLETED ones with a recorded score - the UI
 * requires the admin to type a confirmation phrase before it will send
 * `acknowledgedCompletedLoss: true`, but a Server Function is reachable by a
 * direct POST too, so this re-checks the same condition server-side rather
 * than trusting the flag alone. Shared by both the doubles and singles
 * randomizer commit actions (see randomize-doubles.ts / randomize-singles.ts).
 */
export async function checkCompletedMatchesAcknowledged(
  tournamentId: string,
  acknowledgedCompletedLoss: boolean,
): Promise<string | null> {
  const completedCount = await prisma.match.count({
    where: { tournamentId, status: "COMPLETED" },
  });
  if (completedCount > 0 && !acknowledgedCompletedLoss) {
    return `У турнірі є ${completedCount} завершених матчів із рахунком — підтвердьте видалення в діалозі`;
  }
  return null;
}
