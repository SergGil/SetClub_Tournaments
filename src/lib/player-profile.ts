import type { MatchSide } from "@/generated/prisma/enums";

import { resultForSide } from "./match-result";
import { displayName } from "./player-display";
import { summarizePlayerStats } from "./player-stats";
import type { MatchPlayerRow, PlayerStats } from "./player-stats";

/**
 * The player-profile page logic shared by the Tennis (/players/[id]) and Padel
 * (/padel/players/[id]) profiles: which of a player's matches are visible under
 * the opponent / tournament / result / format / year filters, the head-to-head
 * summary, and the filter-preserving profile hrefs. Pure over already-fetched
 * matches - works for either sport's match rows via the structural
 * ProfileMatch shape (Padel's rows are structurally the same as Tennis's).
 */

/** The fields of a Match/PadelMatch row (with players/sets/tournament included) the profile needs. */
export type ProfileMatch = {
  winnerSide: MatchSide | null;
  walkover: boolean;
  status: string;
  matchType: "SINGLES" | "DOUBLES";
  scheduledDate: Date | null;
  createdAt: Date;
  sets: { sideAGames: number; sideBGames: number }[];
  tournament: { id: string; name: string };
  players: {
    playerId: string;
    side: MatchSide;
    player: { name: string; nickname: string | null; user: { image: string | null } | null };
  }[];
};

export function ownSide(match: ProfileMatch, playerId: string): MatchSide | undefined {
  return match.players.find((p) => p.playerId === playerId)?.side;
}

/** True only if `opponentId` was on the *other* side from `playerId` in this match - not a teammate. */
export function playedAgainst(match: ProfileMatch, playerId: string, opponentId: string): boolean {
  const own = ownSide(match, playerId);
  if (!own) return false;
  return match.players.some((p) => p.playerId === opponentId && p.side !== own);
}

/**
 * "win"/"loss" for this player in this match, or null when it doesn't count as either - see
 * resultForSide (match-result.ts), which this and summarizePlayerStats's decidedRows filter
 * both share, so the win/loss stat tiles and the list they filter always agree on the count.
 */
export function matchResultForPlayer(match: ProfileMatch, playerId: string): "win" | "loss" | null {
  return resultForSide(match.winnerSide, ownSide(match, playerId) ?? null, match.walkover);
}

/** Same scheduledDate-first, createdAt-fallback convention as getResultYears/yearRangeFilter in src/lib/stats.ts. */
export function matchYear(match: ProfileMatch): number {
  return (match.scheduledDate ?? match.createdAt).getUTCFullYear();
}

export type ProfileQuery = { opponent?: string; tournament?: string; result?: string; type?: string; year?: string };

export type ProfileHrefOverrides = {
  opponent?: string;
  tournament?: string;
  result?: "win" | "loss";
  type?: "SINGLES" | "DOUBLES";
  year?: number;
};

export type ProfileOpponent = { id: string; name: string; image: string | null };

export function buildProfileView<M extends ProfileMatch>(
  matches: M[],
  playerId: string,
  query: ProfileQuery,
  basePath: string,
) {
  const selectedResult: "win" | "loss" | undefined =
    query.result === "win" || query.result === "loss" ? query.result : undefined;
  const selectedType: "SINGLES" | "DOUBLES" | undefined =
    query.type === "SINGLES" || query.type === "DOUBLES" ? query.type : undefined;

  const opponentNameById = new Map<string, string>();
  const opponentImageById = new Map<string, string | null>();
  for (const match of matches) {
    const own = ownSide(match, playerId);
    if (!own) continue;
    for (const p of match.players) {
      if (p.side !== own) {
        opponentNameById.set(p.playerId, displayName(p.player));
        opponentImageById.set(p.playerId, p.player.user?.image ?? null);
      }
    }
  }
  const opponents: ProfileOpponent[] = Array.from(opponentNameById, ([id, name]) => ({
    id,
    name,
    image: opponentImageById.get(id) ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name));

  // Most recently played tournament first (the match queries sort recency-first), same
  // recency-first convention as the rating trend badges.
  const tournamentNameById = new Map<string, string>();
  for (const match of matches) {
    if (!tournamentNameById.has(match.tournament.id)) tournamentNameById.set(match.tournament.id, match.tournament.name);
  }
  const tournaments = Array.from(tournamentNameById, ([id, name]) => ({ id, name }));

  const selectedOpponent = query.opponent ? opponents.find((o) => o.id === query.opponent) : undefined;
  const opponentFilteredMatches = selectedOpponent
    ? matches.filter((m) => playedAgainst(m, playerId, selectedOpponent.id))
    : matches;
  const selectedTournament = query.tournament ? tournaments.find((t) => t.id === query.tournament) : undefined;
  const tournamentFilteredMatches = selectedTournament
    ? opponentFilteredMatches.filter((m) => m.tournament.id === selectedTournament.id)
    : opponentFilteredMatches;
  // The result filter doesn't affect the head-to-head summary below - that always reflects the
  // full record against this opponent; only the match list narrows to just wins or losses.
  const resultFilteredMatches = selectedResult
    ? tournamentFilteredMatches.filter((m) => matchResultForPlayer(m, playerId) === selectedResult)
    : tournamentFilteredMatches;
  // Format/year narrowing is only offered once a result is selected; available years come from
  // the player's own decided matches, not a club-wide list.
  const resultYears = Array.from(
    new Set(
      tournamentFilteredMatches.filter((m) => matchResultForPlayer(m, playerId) !== null).map((m) => matchYear(m)),
    ),
  ).sort((a, b) => b - a);
  const selectedYear = query.year ? Number(query.year) : undefined;
  const activeYear = selectedYear && resultYears.includes(selectedYear) ? selectedYear : undefined;
  const visibleMatches = resultFilteredMatches
    .filter((m) => !selectedType || m.matchType === selectedType)
    .filter((m) => !activeYear || matchYear(m) === activeYear);

  const h2hRows: MatchPlayerRow[] = selectedOpponent
    ? opponentFilteredMatches
        .filter((m) => m.status === "COMPLETED" && m.winnerSide !== null)
        .map((m) => ({
          side: ownSide(m, playerId)!,
          match: { winnerSide: m.winnerSide, sets: m.sets, tournamentId: m.tournament.id, walkover: m.walkover },
        }))
    : [];
  const h2hStats: PlayerStats | null = selectedOpponent ? summarizePlayerStats(playerId, h2hRows) : null;
  // Last 5 decided meetings, most recent first - the win/loss "form" dots on the head-to-head
  // card. matchResultForPlayer applies the same walkover exclusion as summarizePlayerStats's
  // decidedRows filter, so this never disagrees with h2hStats.
  const recentH2HResults = selectedOpponent
    ? opponentFilteredMatches
        .map((m) => matchResultForPlayer(m, playerId))
        .filter((r): r is "win" | "loss" => r !== null)
        .slice(0, 5)
    : [];

  function profileHref(overrides: ProfileHrefOverrides = {}): string {
    const opponent = "opponent" in overrides ? overrides.opponent : selectedOpponent?.id;
    const tournament = "tournament" in overrides ? overrides.tournament : selectedTournament?.id;
    const result = "result" in overrides ? overrides.result : selectedResult;
    const type = "type" in overrides ? overrides.type : selectedType;
    const year = "year" in overrides ? overrides.year : activeYear;
    const params = new URLSearchParams();
    if (opponent) params.set("opponent", opponent);
    if (tournament) params.set("tournament", tournament);
    if (result) params.set("result", result);
    if (type) params.set("type", type);
    if (year) params.set("year", String(year));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return {
    opponents,
    tournaments,
    selectedOpponent,
    selectedTournament,
    selectedResult,
    selectedType,
    activeYear,
    resultYears,
    visibleMatches,
    h2hStats,
    recentH2HResults,
    profileHref,
  };
}

export type ProfileView = ReturnType<typeof buildProfileView>;
