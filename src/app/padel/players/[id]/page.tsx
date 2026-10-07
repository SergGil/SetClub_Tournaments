import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { OpponentFilter } from "@/components/opponent-filter";
import { PillFilterGroup, PillFilterLink } from "@/components/pill-filter";
import { RatingClubSection } from "@/components/player-rating-section";
import { StatCard } from "@/components/stat-card";
import { TournamentFilter } from "@/components/tournament-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { findBestPartner } from "@/lib/best-partner";
import { resultForSide } from "@/lib/match-result";
import { getPadelPlayerStats } from "@/lib/padel-stats";
import { displayName, fullDisplayName } from "@/lib/player-display";
import { summarizePlayerStats } from "@/lib/player-stats";
import type { MatchPlayerRow } from "@/lib/player-stats";
import { countLabel, LOSS_FORMS, MATCH_FORMS, pluralizeUk, WIN_FORMS } from "@/lib/pluralize";
import { getPlayerPadelMatches } from "@/lib/queries/padel-matches";
import type { PadelMatchWithDetails } from "@/lib/queries/padel-matches";
import { getPlayerById } from "@/lib/queries/players";
import {
  getPadelDoublesRatings,
  getPadelDoublesRatingsTrend,
  getPadelDoublesSetClubPoints,
  getPadelDoublesSetClubTrend,
  getPadelSinglesRatings,
  getPadelSinglesRatingsTrend,
  getPadelSinglesSetClubPoints,
  getPadelSinglesSetClubTrend,
  getPlayerPadelRatingHistory,
  PADEL_ROLLING_SEASON,
} from "@/lib/rating/padel-ratings-data";
import { buildDoublesRatingCard, buildSinglesRatingCard } from "@/lib/rating/player-rating-cards";
import { cn } from "@/lib/utils";

/**
 * Padel twin of the Tennis profile (src/app/players/[id]/page.tsx), scoped to
 * padel only: padel record, padel ratings (Glicko-2/OpenSkill + SET.club),
 * best partner and match history from padel matches. Deliberately no
 * achievements block - those badges combine tennis and padel (see
 * docs/ACHIEVEMENTS.md), so they stay on the main profile - and no women's
 * rating pool (padel has no women's-only tournaments).
 */

function ownSide(match: PadelMatchWithDetails, playerId: string) {
  return match.players.find((p) => p.playerId === playerId)?.side;
}

/** True only if `opponentId` was on the *other* side from `playerId` in this match - not a teammate. */
function playedAgainst(match: PadelMatchWithDetails, playerId: string, opponentId: string) {
  const own = ownSide(match, playerId);
  if (!own) return false;
  return match.players.some((p) => p.playerId === opponentId && p.side !== own);
}

/** "win"/"loss" for this player in this match, or null - same walkover-aware rule as the stat tiles (resultForSide). */
function matchResultForPlayer(match: PadelMatchWithDetails, playerId: string): "win" | "loss" | null {
  return resultForSide(match.winnerSide, ownSide(match, playerId) ?? null, match.walkover);
}

function matchYear(match: PadelMatchWithDetails) {
  return (match.scheduledDate ?? match.createdAt).getUTCFullYear();
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayerById(id);
  return { title: player ? `${fullDisplayName(player)} — Падел` : "Гравець" };
}

export default async function PadelPlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opponent?: string; tournament?: string; result?: string; type?: string; year?: string }>;
}) {
  const { id } = await params;
  const {
    opponent: opponentId,
    tournament: tournamentId,
    result: resultParam,
    type: typeParam,
    year: yearParam,
  } = await searchParams;
  const selectedResult = resultParam === "win" || resultParam === "loss" ? resultParam : undefined;
  const selectedType = typeParam === "SINGLES" || typeParam === "DOUBLES" ? typeParam : undefined;
  const player = await getPlayerById(id);
  if (!player) notFound();

  const [
    stats,
    matches,
    singlesRatings,
    doublesRatings,
    singlesHistory,
    doublesHistory,
    singlesSetClubPoints,
    doublesSetClubPoints,
    singlesRatingsTrend,
    doublesRatingsTrend,
    singlesSetClubTrend,
    doublesSetClubTrend,
  ] = await Promise.all([
    getPadelPlayerStats(id),
    getPlayerPadelMatches(id),
    getPadelSinglesRatings(),
    getPadelDoublesRatings(),
    getPlayerPadelRatingHistory(id, "SINGLES"),
    getPlayerPadelRatingHistory(id, "DOUBLES"),
    // SET.club badge shows the same rolling-52-week default as /padel/rating.
    getPadelSinglesSetClubPoints(PADEL_ROLLING_SEASON),
    getPadelDoublesSetClubPoints(PADEL_ROLLING_SEASON),
    getPadelSinglesRatingsTrend(),
    getPadelDoublesRatingsTrend(),
    getPadelSinglesSetClubTrend(PADEL_ROLLING_SEASON),
    getPadelDoublesSetClubTrend(PADEL_ROLLING_SEASON),
  ]);

  const ratingSection = {
    singlesCard: buildSinglesRatingCard(id, singlesRatings, singlesRatingsTrend, singlesSetClubPoints, singlesSetClubTrend),
    doublesCard: buildDoublesRatingCard(id, doublesRatings, doublesRatingsTrend, doublesSetClubPoints, doublesSetClubTrend),
    singlesHistory,
    doublesHistory,
  };
  // Match cards show SET.club rank, not the Glicko-2/OpenSkill number above.
  const singlesRankById = Object.fromEntries(singlesSetClubPoints.map((r, i) => [r.playerId, i + 1]));
  const doublesRankById = Object.fromEntries(doublesSetClubPoints.map((r, i) => [r.playerId, i + 1]));

  const bestPartner = findBestPartner(matches, id);

  const opponentNameById = new Map<string, string>();
  const opponentImageById = new Map<string, string | null>();
  for (const match of matches) {
    const own = ownSide(match, id);
    if (!own) continue;
    for (const p of match.players) {
      if (p.side !== own) {
        opponentNameById.set(p.playerId, displayName(p.player));
        opponentImageById.set(p.playerId, p.player.user?.image ?? null);
      }
    }
  }
  const opponents = Array.from(opponentNameById, ([opponentPlayerId, name]) => ({
    id: opponentPlayerId,
    name,
    image: opponentImageById.get(opponentPlayerId) ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name));

  // Most recently played tournament first (matches are sorted that way - see getPlayerPadelMatches).
  const tournamentNameById = new Map<string, string>();
  for (const match of matches) {
    if (!tournamentNameById.has(match.tournament.id)) {
      tournamentNameById.set(match.tournament.id, match.tournament.name);
    }
  }
  const tournaments = Array.from(tournamentNameById, ([tournamentPlayerId, name]) => ({
    id: tournamentPlayerId,
    name,
  }));

  const selectedOpponent = opponentId ? opponents.find((o) => o.id === opponentId) : undefined;
  const opponentFilteredMatches = selectedOpponent
    ? matches.filter((m) => playedAgainst(m, id, selectedOpponent.id))
    : matches;
  const selectedTournament = tournamentId ? tournaments.find((t) => t.id === tournamentId) : undefined;
  const tournamentFilteredMatches = selectedTournament
    ? opponentFilteredMatches.filter((m) => m.tournament.id === selectedTournament.id)
    : opponentFilteredMatches;
  // Result filter doesn't affect the head-to-head summary below - that always
  // reflects the full record against this opponent.
  const resultFilteredMatches = selectedResult
    ? tournamentFilteredMatches.filter((m) => matchResultForPlayer(m, id) === selectedResult)
    : tournamentFilteredMatches;
  const resultYears = Array.from(
    new Set(
      tournamentFilteredMatches
        .filter((m) => matchResultForPlayer(m, id) !== null)
        .map((m) => matchYear(m)),
    ),
  ).sort((a, b) => b - a);
  const selectedYear = yearParam ? Number(yearParam) : undefined;
  const activeYear = selectedYear && resultYears.includes(selectedYear) ? selectedYear : undefined;
  const visibleMatches = resultFilteredMatches
    .filter((m) => !selectedType || m.matchType === selectedType)
    .filter((m) => !activeYear || matchYear(m) === activeYear);

  const h2hRows: MatchPlayerRow[] = selectedOpponent
    ? opponentFilteredMatches
        .filter((m) => m.status === "COMPLETED" && m.winnerSide !== null)
        .map((m) => ({
          side: ownSide(m, id)!,
          match: { winnerSide: m.winnerSide, sets: m.sets, tournamentId: m.tournament.id, walkover: m.walkover },
        }))
    : [];
  const h2hStats = selectedOpponent ? summarizePlayerStats(id, h2hRows) : null;
  const recentH2HResults = selectedOpponent
    ? opponentFilteredMatches
        .map((m) => matchResultForPlayer(m, id))
        .filter((r): r is "win" | "loss" => r !== null)
        .slice(0, 5)
    : [];

  function profileHref(
    overrides: {
      opponent?: string;
      tournament?: string;
      result?: "win" | "loss";
      type?: "SINGLES" | "DOUBLES";
      year?: number;
    } = {},
  ) {
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
    return qs ? `/padel/players/${id}?${qs}` : `/padel/players/${id}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/padel/players" className="text-sm text-foreground/80 hover:text-foreground">
        ← Усі гравці падела
      </Link>
      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarImage src={player.user?.image ?? undefined} alt={player.name} />
          <AvatarFallback className="text-lg">{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {fullDisplayName(player)}
          </h1>
          {stats.matchesPlayed > 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-foreground/80">
              <span>{countLabel(stats.matchesPlayed, MATCH_FORMS)}</span>
              <span className="text-border">·</span>
              <span className="tabular-nums">
                <span className="text-foreground">{stats.wins}</span>–{stats.losses}
              </span>
              <span className="text-border">·</span>
              <span className="tabular-nums">{stats.winPct}% перемог</span>
            </p>
          ) : (
            <p className="text-sm text-foreground/80">Ще немає жодного матчу в падел</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={capitalize(pluralizeUk(stats.matchesPlayed, MATCH_FORMS))}
          value={stats.matchesPlayed}
          href={profileHref({ result: undefined, type: undefined, year: undefined })}
        />
        <StatCard
          label={capitalize(pluralizeUk(stats.wins, WIN_FORMS))}
          value={stats.wins}
          tone="positive"
          href={profileHref({ result: selectedResult === "win" ? undefined : "win" })}
          active={selectedResult === "win"}
        />
        <StatCard
          label={capitalize(pluralizeUk(stats.losses, LOSS_FORMS))}
          value={stats.losses}
          tone="negative"
          href={profileHref({ result: selectedResult === "loss" ? undefined : "loss" })}
          active={selectedResult === "loss"}
        />
        <StatCard label="% перемог" value={`${stats.winPct}%`} barPct={stats.winPct} />
      </div>

      <RatingClubSection title="Рейтинг клубу (падел)" section={ratingSection} basePath="/padel/rating" />

      {bestPartner && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Найкращий партнер (парні)</p>
              <Link
                href={`/padel/players/${bestPartner.partnerId}`}
                className="text-lg font-semibold hover:underline"
              >
                {bestPartner.name}
              </Link>
            </div>
            <p className="text-sm tabular-nums text-muted-foreground">
              <span className="text-foreground">{bestPartner.wins}</span>–{bestPartner.losses}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {selectedOpponent
              ? `Особисті зустрічі: ${selectedOpponent.name}`
              : selectedTournament
                ? selectedTournament.name
                : "Історія матчів"}
            {selectedResult && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({selectedResult === "win" ? "лише перемоги" : "лише поразки"})
              </span>
            )}
          </h2>
          {(tournaments.length > 0 || opponents.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {tournaments.length > 0 && (
                <TournamentFilter
                  tournaments={tournaments}
                  selectedId={selectedTournament?.id ?? ""}
                  opponent={selectedOpponent?.id}
                  result={selectedResult}
                  type={selectedType}
                  year={activeYear}
                />
              )}
              {opponents.length > 0 && (
                <OpponentFilter
                  opponents={opponents}
                  selectedId={selectedOpponent?.id ?? ""}
                  tournament={selectedTournament?.id}
                  result={selectedResult}
                  type={selectedType}
                  year={activeYear}
                />
              )}
            </div>
          )}
        </div>

        {selectedOpponent && h2hStats && h2hStats.matchesPlayed > 0 && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-center gap-5 p-4 sm:gap-8">
              <div className="flex flex-col items-center gap-1.5">
                <Avatar className="size-12">
                  <AvatarImage src={player.user?.image ?? undefined} alt={player.name} />
                  <AvatarFallback>{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="max-w-24 text-center text-sm font-medium text-balance">
                  {displayName(player)}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <p
                  className="flex items-baseline gap-2 text-3xl font-extrabold tabular-nums"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <span className="text-primary">{h2hStats.wins}</span>
                  <span className="text-xl font-normal text-muted-foreground">–</span>
                  <span>{h2hStats.losses}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {countLabel(h2hStats.matchesPlayed, MATCH_FORMS)} із визначеним переможцем
                </p>
                {recentH2HResults.length > 1 && (
                  <div
                    className="mt-0.5 flex items-center gap-1"
                    title="Останні зустрічі (зліва — новіші)"
                  >
                    {recentH2HResults.map((result, i) => (
                      <span
                        key={i}
                        className={cn(
                          "size-2 rounded-full",
                          result === "win" ? "bg-primary" : "bg-destructive",
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <Avatar className="size-12">
                  <AvatarImage src={selectedOpponent.image ?? undefined} alt={selectedOpponent.name} />
                  <AvatarFallback>{selectedOpponent.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="max-w-24 text-center text-sm font-medium text-balance">
                  {selectedOpponent.name}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Format/year narrowing only makes sense once the list is already
            scoped to just wins or losses. */}
        {selectedResult && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Формат:</span>
              <PillFilterGroup>
                <PillFilterLink href={profileHref({ type: undefined })} active={!selectedType}>
                  Усі
                </PillFilterLink>
                <PillFilterLink href={profileHref({ type: "SINGLES" })} active={selectedType === "SINGLES"}>
                  Одиночні
                </PillFilterLink>
                <PillFilterLink href={profileHref({ type: "DOUBLES" })} active={selectedType === "DOUBLES"}>
                  Парні
                </PillFilterLink>
              </PillFilterGroup>
            </div>
            {resultYears.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Рік:</span>
                <PillFilterGroup>
                  <PillFilterLink href={profileHref({ year: undefined })} active={!activeYear}>
                    Усі роки
                  </PillFilterLink>
                  {resultYears.map((y) => (
                    <PillFilterLink
                      key={y}
                      href={profileHref({ year: y })}
                      active={activeYear === y}
                      className="tabular-nums"
                    >
                      {y}
                    </PillFilterLink>
                  ))}
                </PillFilterGroup>
              </div>
            )}
          </div>
        )}

        {visibleMatches.length === 0 && (
          <p className="text-foreground/80">
            {selectedResult === "win" && "Перемог ще немає."}
            {selectedResult === "loss" && "Поразок ще немає."}
            {!selectedResult && "Матчів ще немає."}
          </p>
        )}
        {visibleMatches.map((match) => (
          <MatchSummary
            key={match.id}
            match={match}
            sport="PADEL"
            perspectivePlayerId={id}
            singlesRankById={singlesRankById}
            doublesRankById={doublesRankById}
          />
        ))}
      </div>
    </div>
  );
}
