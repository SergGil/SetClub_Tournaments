import type { Prisma } from "@/generated/prisma/client";
import type { TournamentBracketSnapshot } from "@/lib/bracket-advancement";

// Deliberately NOT a "use server" file: Next.js only allows async functions
// to be exported from one of those (a plain class export like
// CascadeResetPendingError below breaks the build), and buildBracketSnapshot
// itself isn't meant to be an invocable Server Action - it's an internal
// helper shared between saveScoreAction/deleteMatchAction
// (src/lib/actions/matches.ts) and withdrawParticipantAction
// (src/lib/actions/tournaments.ts). No `import "server-only"` guard here
// (unlike src/lib/permissions.ts) - that package's real export unconditionally
// throws outside Next's webpack build (which aliases it away server-side),
// so it'd break this file being loaded for real by the action tests below
// instead of through a vi.mock. Safe without it regardless: this module is
// only ever imported by other "use server" action files, never directly by
// a client component.

export type CascadeReset = { matchId: string; round: string | null; sideALabel: string; sideBLabel: string };

/**
 * Thrown from inside saveScoreAction's/deleteMatchAction's/
 * withdrawParticipantAction's transaction to force a rollback (same "roll
 * back the whole tx" idiom as matches.ts's StaleScoreConflictError) when a
 * change would cascade-reset one or more already-COMPLETED downstream
 * bracket matches and the caller hasn't confirmed via
 * acknowledgedCascadeReset yet - see bracket-advancement.ts and
 * docs/GROUPS12_PLAYOFF.md.
 */
export class CascadeResetPendingError extends Error {
  constructor(public readonly resets: CascadeReset[]) {
    super("cascade reset pending confirmation");
  }
}

/**
 * Builds the read-only bracket snapshot bracket-advancement.ts's resolver
 * needs, from inside a transaction so it sees the just-applied score write
 * (or, for deleteMatchAction, the row about to be removed). Shared by
 * saveScoreAction/deleteMatchAction (matches.ts) and
 * withdrawParticipantAction (tournaments.ts), which runs the exact same
 * fill/reset propagation after bulk-closing a withdrawn player's SCHEDULED
 * matches as walkovers.
 */
export async function buildBracketSnapshot(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<TournamentBracketSnapshot> {
  const [matches, advancementRows, participants] = await Promise.all([
    tx.match.findMany({
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
    tx.matchAdvancement.findMany({
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
    tx.tournamentParticipant.findMany({
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
