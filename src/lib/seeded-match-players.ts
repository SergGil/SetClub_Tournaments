import { seededFirstPerSide } from "@/lib/player-display";

/** The seeded roster entries (`TournamentParticipant.seed !== null`) of the given tournaments - supplied per sport (Tennis/Padel have separate participant tables). */
export type SeededParticipantsLoader = (tournamentIds: string[]) => Promise<{ tournamentId: string; playerId: string }[]>;

type OrderableMatch = { tournamentId: string; players: { side: string; playerId: string }[] };

/**
 * Reorders every doubles match's players so each side's pair reads
 * "сіяний / несіяний" - the one place that rule is applied to match rows, so
 * every consumer of the match queries (public pages, admin lists, CSV export,
 * share cards, the mobile API) gets it for free. A match's `players` carry
 * no seed of their own - that lives on the tournament's roster entry - hence
 * the one extra lookup, skipped entirely when no match has a pair on a side
 * (all singles). Pairs with no or two seeds keep their order.
 */
export async function seededFirstMatches<M extends OrderableMatch>(
  matches: M[],
  loadSeeded: SeededParticipantsLoader,
): Promise<M[]> {
  const tournamentIds = [...new Set(matches.filter((m) => m.players.length > 2).map((m) => m.tournamentId))];
  if (tournamentIds.length === 0) return matches;

  const seededByTournament = new Map<string, Set<string>>();
  for (const { tournamentId, playerId } of await loadSeeded(tournamentIds)) {
    const seeded = seededByTournament.get(tournamentId) ?? new Set<string>();
    seeded.add(playerId);
    seededByTournament.set(tournamentId, seeded);
  }

  return matches.map((match) => {
    const seeded = seededByTournament.get(match.tournamentId);
    return seeded ? { ...match, players: seededFirstPerSide(match.players, seeded) } : match;
  });
}
