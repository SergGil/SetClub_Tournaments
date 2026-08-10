import { displayName } from "@/lib/player-display";
import type { MatchWithDetails } from "@/lib/queries/matches";

export type BestPartner = { partnerId: string; name: string; wins: number; losses: number };

/**
 * The doubles partner this player has the best win% with (min. 1 shared
 * match; ties broken by more matches played together) - pure post-processing
 * of already-fetched matches (getPlayerMatches already returns everything
 * needed), the same style as summarizePlayerStats/matchResultForPlayer on
 * the player profile page. No new query.
 *
 * Deliberately no "minimum N matches" cutoff to qualify - the W-L shown
 * alongside the name lets the viewer judge the sample size themselves, the
 * same transparency summarizePlayerStats already relies on for its raw
 * win/loss counts.
 */
export function findBestPartner(matches: MatchWithDetails[], playerId: string): BestPartner | null {
  const tally = new Map<string, { name: string; wins: number; losses: number }>();

  for (const match of matches) {
    if (match.matchType !== "DOUBLES" || match.winnerSide === null) continue;
    const own = match.players.find((p) => p.playerId === playerId);
    if (!own) continue;
    // Same walkover exception as matchResultForPlayer/summarizePlayerStats -
    // a withdrawn player never takes a personal loss for a match they didn't
    // play, so it shouldn't drag down a partner's record either.
    if (match.walkover && match.winnerSide !== own.side) continue;
    const partner = match.players.find((p) => p.side === own.side && p.playerId !== playerId);
    if (!partner) continue;

    const entry = tally.get(partner.playerId) ?? { name: displayName(partner.player), wins: 0, losses: 0 };
    if (match.winnerSide === own.side) entry.wins += 1;
    else entry.losses += 1;
    tally.set(partner.playerId, entry);
  }

  const ranked = [...tally.entries()].map(([partnerId, entry]) => ({ partnerId, ...entry }));
  ranked.sort((a, b) => {
    const aPlayed = a.wins + a.losses;
    const bPlayed = b.wins + b.losses;
    const aWinPct = aPlayed > 0 ? a.wins / aPlayed : 0;
    const bWinPct = bPlayed > 0 ? b.wins / bPlayed : 0;
    return bWinPct - aWinPct || bPlayed - aPlayed;
  });

  return ranked[0] ?? null;
}
