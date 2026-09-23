import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { OpponentFilter } from "@/components/opponent-filter";
import { PillFilterGroup, PillFilterLink } from "@/components/pill-filter";
import { PlayerAchievements } from "@/components/player-achievements";
import { TournamentFilter } from "@/components/tournament-filter";
import { RankTrendArrow } from "@/components/rank-trend-arrow";
import { RatingHistoryChart } from "@/components/rating-history-chart";
import { StatCard } from "@/components/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildGiantKillerMatchIds, buildPlayerAchievements, toAchievementMatchInput } from "@/lib/achievements";
import type { AchievementMatchInput } from "@/lib/achievements";
import { findBestPartner } from "@/lib/best-partner";
import { resultForSide } from "@/lib/match-result";
import { countLabel, LOSS_FORMS, MATCH_FORMS, pluralizeUk, POINT_FORMS, WIN_FORMS } from "@/lib/pluralize";
import { displayName, fullDisplayName } from "@/lib/player-display";
import { cn } from "@/lib/utils";
import { summarizePlayerStats } from "@/lib/player-stats";
import type { MatchPlayerRow } from "@/lib/player-stats";
import { getPlayerMatches } from "@/lib/queries/matches";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { getPlayerPadelMatches } from "@/lib/queries/padel-matches";
import { getPlayerById } from "@/lib/queries/players";
import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";
import { getPadelUpsetWinsByPlayer } from "@/lib/rating/padel-ratings-data";
import {
  getDoublesRatings,
  getDoublesRatingsTrend,
  getDoublesSetClubPoints,
  getDoublesSetClubTrend,
  getPlayerRatingHistory,
  getSinglesRatings,
  getSinglesRatingsTrend,
  getSinglesSetClubPoints,
  getSinglesSetClubTrend,
  getUpsetWinsByPlayer,
  PROVISIONAL_MATCH_THRESHOLD,
  ROLLING_SEASON,
} from "@/lib/rating/ratings-data";
import type { RatingHistoryPoint } from "@/lib/rating/ratings-data";
import { getPlayerStats } from "@/lib/stats";

function ownSide(match: MatchWithDetails, playerId: string) {
  return match.players.find((p) => p.playerId === playerId)?.side;
}

/** True only if `opponentId` was on the *other* side from `playerId` in this match - not a teammate. */
function playedAgainst(match: MatchWithDetails, playerId: string, opponentId: string) {
  const own = ownSide(match, playerId);
  if (!own) return false;
  return match.players.some((p) => p.playerId === opponentId && p.side !== own);
}

/**
 * "win"/"loss" for this player in this match, or null when it doesn't count
 * as either - see resultForSide (match-result.ts), which this and
 * summarizePlayerStats's decidedRows filter both share, so the win/loss
 * stat tiles and the list they filter always agree on the count.
 */
function matchResultForPlayer(match: MatchWithDetails, playerId: string): "win" | "loss" | null {
  return resultForSide(match.winnerSide, ownSide(match, playerId) ?? null, match.walkover);
}

/** Same scheduledDate-first, createdAt-fallback convention as getResultYears/yearRangeFilter in src/lib/stats.ts. */
function matchYear(match: MatchWithDetails) {
  return (match.scheduledDate ?? match.createdAt).getUTCFullYear();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayerById(id);
  return { title: player ? fullDisplayName(player) : "Гравець" };
}

export default async function PlayerProfilePage({
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
    padelMatches,
    singlesUpsetsByPlayer,
    doublesUpsetsByPlayer,
    padelSinglesUpsetsByPlayer,
    padelDoublesUpsetsByPlayer,
  ] = await Promise.all([
    getPlayerStats(id),
    getPlayerMatches(id),
    getSinglesRatings(),
    getDoublesRatings(),
    getPlayerRatingHistory(id, "SINGLES"),
    getPlayerRatingHistory(id, "DOUBLES"),
    // SET.club badge shows the same rolling-52-week default as /rating (see ROLLING_SEASON).
    getSinglesSetClubPoints(ROLLING_SEASON),
    getDoublesSetClubPoints(ROLLING_SEASON),
    getSinglesRatingsTrend(),
    getDoublesRatingsTrend(),
    getSinglesSetClubTrend(ROLLING_SEASON),
    getDoublesSetClubTrend(ROLLING_SEASON),
    // Achievements (docs/ACHIEVEMENTS.md) count across tennis + padel, both
    // formats, combined - the rest of this page stays tennis-only (padel has
    // no profile page of its own; see the doc's "Свіжі ідеї" scope note).
    getPlayerPadelMatches(id),
    getUpsetWinsByPlayer("SINGLES"),
    getUpsetWinsByPlayer("DOUBLES"),
    getPadelUpsetWinsByPlayer("SINGLES"),
    getPadelUpsetWinsByPlayer("DOUBLES"),
  ]);

  const giantKillerMatchIds = buildGiantKillerMatchIds(id, [
    singlesUpsetsByPlayer,
    doublesUpsetsByPlayer,
    padelSinglesUpsetsByPlayer,
    padelDoublesUpsetsByPlayer,
  ]);
  const achievementInputs = [...matches, ...padelMatches]
    .map((m) => toAchievementMatchInput(m, id, giantKillerMatchIds.has(m.id)))
    .filter((m): m is AchievementMatchInput => m !== null);
  const achievements = buildPlayerAchievements(achievementInputs);

  const singlesRankRaw = singlesRatings.findIndex((row) => row.playerId === id);
  const doublesRankRaw = doublesRatings.findIndex((row) => row.playerId === id);
  const singlesSetClubRank = singlesSetClubPoints.findIndex((row) => row.playerId === id);
  const doublesSetClubRank = doublesSetClubPoints.findIndex((row) => row.playerId === id);
  // Match cards below show SET.club rank/points, not the Glicko-2/OpenSkill
  // ones used for singlesRank/doublesRank above (those only feed the "Рейтинг
  // клубу" cards' own official-model numbers).
  const singlesRankById = Object.fromEntries(singlesSetClubPoints.map((r, i) => [r.playerId, i + 1]));
  const doublesRankById = Object.fromEntries(doublesSetClubPoints.map((r, i) => [r.playerId, i + 1]));

  // Same PROVISIONAL_MATCH_THRESHOLD split as /rating and /padel/rating - a
  // player with too few completed matches gets a rank number nowhere in the
  // app, including here, instead of an oddly confident "# 7 з 15" contradicted
  // by their own absence from the numbered table.
  const rankedSinglesRatings = singlesRatings.filter(
    (row) => row.matchesPlayed >= PROVISIONAL_MATCH_THRESHOLD,
  );
  const rankedDoublesRatings = doublesRatings.filter(
    (row) => row.matchesPlayed >= PROVISIONAL_MATCH_THRESHOLD,
  );
  const singlesRank = rankedSinglesRatings.findIndex((row) => row.playerId === id);
  const doublesRank = rankedDoublesRatings.findIndex((row) => row.playerId === id);
  const singlesIsProvisional = singlesRankRaw >= 0 && singlesRank < 0;
  const doublesIsProvisional = doublesRankRaw >= 0 && doublesRank < 0;

  const singlesRatingCard =
    singlesRankRaw >= 0
      ? {
          rating: Math.round(conservativeRating(singlesRatings[singlesRankRaw].rating)),
          spread: Math.round(singlesRatings[singlesRankRaw].rating.rd),
          rank: singlesIsProvisional ? null : singlesRank + 1,
          rankDelta: singlesRatingsTrend.get(id),
          total: rankedSinglesRatings.length,
          isProvisional: singlesIsProvisional,
          setClub:
            singlesSetClubRank >= 0
              ? {
                  points: singlesSetClubPoints[singlesSetClubRank].points,
                  rank: singlesSetClubRank + 1,
                  rankDelta: singlesSetClubTrend.get(id),
                  total: singlesSetClubPoints.length,
                }
              : null,
        }
      : null;
  const doublesRatingCard =
    doublesRankRaw >= 0
      ? {
          rating: Math.round(conservativeOrdinal(doublesRatings[doublesRankRaw].rating)),
          spread: Math.round(displaySpread(doublesRatings[doublesRankRaw].rating.sigma)),
          rank: doublesIsProvisional ? null : doublesRank + 1,
          rankDelta: doublesRatingsTrend.get(id),
          total: rankedDoublesRatings.length,
          isProvisional: doublesIsProvisional,
          setClub:
            doublesSetClubRank >= 0
              ? {
                  points: doublesSetClubPoints[doublesSetClubRank].points,
                  rank: doublesSetClubRank + 1,
                  rankDelta: doublesSetClubTrend.get(id),
                  total: doublesSetClubPoints.length,
                }
              : null,
        }
      : null;

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

  // Order follows `matches` (scheduledDate desc, createdAt desc as fallback -
  // see getPlayerMatches), so the most recently played tournament sorts
  // first, same recency-first convention as the rating trend badges above.
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
  // Result filter is separate from (and doesn't affect) the head-to-head
  // summary below - that always reflects the full record against this
  // opponent, only the match list itself narrows to just wins or losses.
  const resultFilteredMatches = selectedResult
    ? tournamentFilteredMatches.filter((m) => matchResultForPlayer(m, id) === selectedResult)
    : tournamentFilteredMatches;
  // Format/year years scoped to the win/loss view are only offered once a
  // result is selected (see the PillFilterGroups below) - available years
  // are computed from the player's own decided matches, not the club-wide
  // getResultYears (src/lib/stats.ts), which isn't scoped to one player.
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
  // Last 5 decided meetings, most recent first (opponentFilteredMatches
  // already sorts that way - see getPlayerMatches) - the win/loss "form"
  // dots on the head-to-head card below. matchResultForPlayer applies the
  // exact same walkover exclusion as summarizePlayerStats's decidedRows
  // filter (see its own doc comment), so this never disagrees with h2hStats.
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
    return qs ? `/players/${id}?${qs}` : `/players/${id}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/players" className="text-sm text-foreground/80 hover:text-foreground">
        ← Усі гравці
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
            <p className="text-sm text-foreground/80">Ще немає жодного матчу</p>
          )}
        </div>
      </div>

      <PlayerAchievements achievements={achievements} />

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

      {(singlesRatingCard || doublesRatingCard) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Рейтинг клубу</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {singlesRatingCard && (
              <RatingCard
                format="singles"
                label="Одиночний"
                badgeVariant="accent"
                badgeLabel="Glicko-2"
                history={singlesHistory}
                {...singlesRatingCard}
              />
            )}
            {doublesRatingCard && (
              <RatingCard
                format="doubles"
                label="Парний"
                badgeVariant="teal"
                badgeLabel="OpenSkill"
                history={doublesHistory}
                {...doublesRatingCard}
              />
            )}
          </div>
        </div>
      )}

      {bestPartner && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Найкращий партнер (парні)</p>
              <Link href={`/players/${bestPartner.partnerId}`} className="text-lg font-semibold hover:underline">
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
            scoped to just wins or losses - browsing the full history doesn't
            need it, and offering it there would just add clutter. */}
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
            perspectivePlayerId={id}
            singlesRankById={singlesRankById}
            doublesRankById={doublesRankById}
          />
        ))}
      </div>
    </div>
  );
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function RatingCard({
  format,
  label,
  badgeVariant,
  badgeLabel,
  rating,
  spread,
  rank,
  rankDelta,
  total,
  isProvisional,
  setClub,
  history,
}: {
  format: "singles" | "doubles";
  label: string;
  badgeVariant: "accent" | "teal";
  badgeLabel: string;
  rating: number;
  spread: number;
  rank: number | null;
  rankDelta: number | undefined;
  total: number;
  isProvisional: boolean;
  setClub: { points: number; rank: number; rankDelta: number | undefined; total: number } | null;
  history: RatingHistoryPoint[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <Link href={`/rating?format=${format}`} className="flex flex-col gap-3 transition hover:opacity-90">
          <p className="text-sm font-medium text-muted-foreground">{label} рейтинг</p>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {rating}
                <span className="ml-1 text-sm font-normal text-muted-foreground">±{spread}</span>
              </p>
              {isProvisional ? (
                <p className="text-sm text-muted-foreground">Рейтинг ще формується</p>
              ) : (
                <p className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground"># {rank}</span> з {total} гравців
                  <RankTrendArrow delta={rankDelta} />
                </p>
              )}
            </div>
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          </div>

          {setClub && (
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <div>
                <p className="text-lg font-semibold tabular-nums">
                  {setClub.points}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {pluralizeUk(setClub.points, POINT_FORMS)}
                  </span>
                </p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground"># {setClub.rank}</span> з {setClub.total}{" "}
                  гравців
                  <RankTrendArrow delta={setClub.rankDelta} />
                </p>
              </div>
              <Badge variant="orange">SET.club</Badge>
            </div>
          )}
        </Link>

        {history.length >= 2 && (
          <div className="border-t pt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Рейтинг у часі</p>
            <RatingHistoryChart points={history} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
