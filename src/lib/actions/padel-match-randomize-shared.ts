// Padel twin of match-randomize-shared.ts - see its comment for why this is
// deliberately NOT a "use server" file.

import { prisma } from "@/lib/db";

export type NamedPlayer = { playerId: string; name: string };
export type CommitState = { error?: string; success?: boolean; matchCount?: number };

/**
 * Padel twin of checkCompletedMatchesAcknowledged - re-running a randomizer
 * or resetting/deleting a tournament deletes every existing COMPLETED match
 * with a recorded score, so this re-checks the confirmation server-side
 * rather than trusting the client's flag alone.
 */
export async function checkPadelCompletedMatchesAcknowledged(
  tournamentId: string,
  acknowledgedCompletedLoss: boolean,
): Promise<string | null> {
  const completedCount = await prisma.padelMatch.count({
    where: { tournamentId, status: "COMPLETED" },
  });
  if (completedCount > 0 && !acknowledgedCompletedLoss) {
    return `У турнірі є ${completedCount} завершених матчів із рахунком — підтвердьте видалення в діалозі`;
  }
  return null;
}
