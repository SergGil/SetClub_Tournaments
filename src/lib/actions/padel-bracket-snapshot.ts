import type { Prisma } from "@/generated/prisma/client";
import type { TournamentBracketSnapshot } from "@/lib/bracket-advancement";

// Padel twin of bracket-snapshot.ts - reuses bracket-advancement.ts as-is
// (pure logic over a plain snapshot shape, no Prisma coupling) and only
// re-implements the read side against the Padel* models. See
// bracket-snapshot.ts for the full rationale (not a "use server" file,
// no server-only guard).

export type CascadeReset = { matchId: string; round: string | null; sideALabel: string; sideBLabel: string };

export class CascadeResetPendingError extends Error {
  constructor(public readonly resets: CascadeReset[]) {
    super("cascade reset pending confirmation");
  }
}

/**
 * Builds the read-only bracket snapshot bracket-advancement.ts's resolver
 * needs, from inside a transaction so it sees the just-applied score write.
 * Shared by savePadelScoreAction/deletePadelMatchAction (padel-matches.ts)
 * and withdrawPadelParticipantAction (padel-tournaments.ts) - Padel twin of
 * buildBracketSnapshot.
 */
export async function buildPadelBracketSnapshot(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<TournamentBracketSnapshot> {
  const [matches, advancementRows, participants] = await Promise.all([
    tx.padelMatch.findMany({
      where: { tournamentId },
      select: {
        id: true,
        round: true,
        status: true,
        winnerSide: true,
        players: { select: { side: true, playerId: true } },
        sets: { select: { sideAGames: true, sideBGames: true } },
        walkover: true,
      },
    }),
    tx.padelMatchAdvancement.findMany({
      where: { tournamentId },
      select: {
        matchId: true,
        side: true,
        source: true,
        sourceGroup: true,
        sourceRank: true,
        sourceMatchId: true,
        outcome: true,
      },
    }),
    tx.padelTournamentParticipant.findMany({
      where: { tournamentId },
      select: { playerId: true, group: true, withdrawnAt: true, player: { select: { name: true } } },
    }),
  ]);

  return {
    matches,
    advancements: advancementRows.map((a) =>
      a.source === "GROUP_RANK"
        ? {
            matchId: a.matchId,
            side: a.side,
            source: "GROUP_RANK" as const,
            sourceGroup: a.sourceGroup!,
            sourceRank: a.sourceRank as 1 | 2 | 3,
          }
        : {
            matchId: a.matchId,
            side: a.side,
            source: "MATCH_RESULT" as const,
            sourceMatchId: a.sourceMatchId!,
            outcome: a.outcome!,
          },
    ),
    participants: participants.map((p) => ({
      playerId: p.playerId,
      name: p.player.name,
      group: p.group,
      withdrawnAt: p.withdrawnAt ? p.withdrawnAt.toISOString() : null,
    })),
  };
}
