import { MATCH_TYPE_LABEL, normalizeRoundLabel } from "@/lib/match-display";
import { displayName, retiredLabel } from "@/lib/player-display";
import type { MatchWithDetails } from "@/lib/queries/matches";

export type MatchShareSide = {
  players: { name: string; image: string | null }[];
  isWinner: boolean;
  sets: { value: number; tiebreak: number | null }[];
};

export type MatchShareData = {
  tournamentName: string;
  round: string | null;
  matchTypeLabel: string;
  /** "Знявся з матчу"/"Технічна поразка" - null for a normally-played match. */
  badge: string | null;
  sideA: MatchShareSide;
  sideB: MatchShareSide;
};

/**
 * Shapes a completed match into plain data for the share-card image (see
 * src/lib/share/match-card-image.tsx) - kept separate from the JSX so this
 * logic (winner side, retired/walkover wording) is unit-testable without
 * rendering through Satori/ImageResponse, which the rest of the app never
 * bothers testing (see src/app/icon.tsx and friends).
 *
 * Returns null for anything other than a decided COMPLETED match - a
 * SCHEDULED/CANCELLED match, or the (shouldn't-happen) case of a COMPLETED
 * match with no winnerSide, has nothing meaningful to put on a result card.
 */
export function buildMatchShareData(match: MatchWithDetails): MatchShareData | null {
  if (match.status !== "COMPLETED" || !match.winnerSide) return null;

  const sideAPlayers = match.players.filter((p) => p.side === "A");
  const sideBPlayers = match.players.filter((p) => p.side === "B");

  const retiringPlayers = match.winnerSide === "A" ? sideBPlayers : sideAPlayers;
  const badge = match.retired
    ? retiredLabel(retiringPlayers.map((p) => p.player))
    : match.walkover
      ? "Технічна поразка"
      : null;

  return {
    tournamentName: match.tournament.name,
    round: match.round ? normalizeRoundLabel(match.round) : null,
    matchTypeLabel: MATCH_TYPE_LABEL[match.matchType],
    badge,
    sideA: {
      players: sideAPlayers.map((p) => ({ name: displayName(p.player), image: p.player.user?.image ?? null })),
      isWinner: match.winnerSide === "A",
      sets: match.sets.map((set) => ({ value: set.sideAGames, tiebreak: set.tiebreakSideAPoints })),
    },
    sideB: {
      players: sideBPlayers.map((p) => ({ name: displayName(p.player), image: p.player.user?.image ?? null })),
      isWinner: match.winnerSide === "B",
      sets: match.sets.map((set) => ({ value: set.sideBGames, tiebreak: set.tiebreakSideBPoints })),
    },
  };
}
