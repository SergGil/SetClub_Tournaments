import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { OpponentFilter } from "@/components/opponent-filter";
import { PillFilterGroup, PillFilterLink } from "@/components/pill-filter";
import { PlayerAchievements } from "@/components/player-achievements";
import { RatingClubSection } from "@/components/player-rating-section";
import { TournamentFilter } from "@/components/tournament-filter";
import { StatCard } from "@/components/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { buildGiantKillerMatchIds, buildPlayerAchievements, toAchievementMatchInput } from "@/lib/achievements";
import type { AchievementMatchInput } from "@/lib/achievements";
import { findBestPartner } from "@/lib/best-partner";
import { resultForSide } from "@/lib/match-result";
import { countLabel, LOSS_FORMS, MATCH_FORMS, pluralizeUk, WIN_FORMS } from "@/lib/pluralize";
import { displayName, fullDisplayName } from "@/lib/player-display";
import { cn } from "@/lib/utils";
import { summarizePlayerStats } from "@/lib/player-stats";
import type { MatchPlayerRow } from "@/lib/player-stats";
import { getPlayerMatches } from "@/lib/queries/matches";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { getPlayerById } from "@/lib/queries/players";
import { getWomensOnlyTournamentIds } from "@/lib/queries/tournaments";
import type { MatchUpsetCheck } from "@/lib/rating/engine";
import { buildDoublesRatingCard, buildSinglesRatingCard } from "@/lib/rating/player-rating-cards";
import type { RatingCardData } from "@/lib/rating/player-rating-cards";
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
  ROLLING_SEASON,
} from "@/lib/rating/ratings-data";
import type { RatingHistoryPoint, RatingScope } from "@/lib/rating/ratings-data";
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

type PlayerRatingSection = {
  singlesCard: RatingCardData | null;
  doublesCard: RatingCardData | null;
  singlesHistory: RatingHistoryPoint[];
  doublesHistory: RatingHistoryPoint[];
  singlesUpsetsByPlayer: Record<string, MatchUpsetCheck[]>;
  doublesUpsetsByPlayer: Record<string, MatchUpsetCheck[]>;
  singlesRankById: Record<string, number>;
  doublesRankById: Record<string, number>;
};

/**
 * Everything the profile's "Рейтинг клубу" section(s) need for one rating
 * pool (see RatingScope) - called once for "general" and once for "women"
 * (docs/RATING.md) so a player whose matches are entirely in women-only
 * tournaments still gets a rating card instead of showing up unrated on
 * their own profile.
 */
async function fetchPlayerRatingSection(playerId: string, scope: RatingScope): Promise<PlayerRatingSection> {
  const [
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
    singlesUpsetsByPlayer,
    doublesUpsetsByPlayer,
  ] = await Promise.all([
    getSinglesRatings(scope),
    getDoublesRatings(scope),
    getPlayerRatingHistory(playerId, "SINGLES", scope),
    getPlayerRatingHistory(playerId, "DOUBLES", scope),
    // SET.club badge shows the same rolling-52-week default as /rating (see ROLLING_SEASON).
    getSinglesSetClubPoints(ROLLING_SEASON, scope),
    getDoublesSetClubPoints(ROLLING_SEASON, scope),
    getSinglesRatingsTrend(scope),
    getDoublesRatingsTrend(scope),
    getSinglesSetClubTrend(ROLLING_SEASON, scope),
    getDoublesSetClubTrend(ROLLING_SEASON, scope),
    getUpsetWinsByPlayer("SINGLES", scope),
    getUpsetWinsByPlayer("DOUBLES", scope),
  ]);

  return {
    singlesCard: buildSinglesRatingCard(playerId, singlesRatings, singlesRatingsTrend, singlesSetClubPoints, singlesSetClubTrend),
    doublesCard: buildDoublesRatingCard(playerId, doublesRatings, doublesRatingsTrend, doublesSetClubPoints, doublesSetClubTrend),
    singlesHistory,
    doublesHistory,
    singlesUpsetsByPlayer,
    doublesUpsetsByPlayer,
    // Match cards below show SET.club rank/points, not the Glicko-2/OpenSkill
    // ones used for the rating cards above (those only feed this pool's own
    // official-model numbers).
    singlesRankById: Object.fromEntries(singlesSetClubPoints.map((r, i) => [r.playerId, i + 1])),
    doublesRankById: Object.fromEntries(doublesSetClubPoints.map((r, i) => [r.playerId, i + 1])),
  };
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

  const [stats, matches, generalSection, womenSection, womensOnlyTournamentIds] = await Promise.all([
    getPlayerStats(id),
    getPlayerMatches(id),
    fetchPlayerRatingSection(id, "general"),
    fetchPlayerRatingSection(id, "women"),
    getWomensOnlyTournamentIds(),
  ]);

  // Achievements on this profile are tennis-only (docs/ACHIEVEMENTS.md) - the padel profile
  // (/padel/players/[id]) shows the padel ones, computed the same way from padel matches.
  const giantKillerMatchIds = buildGiantKillerMatchIds(id, [
    generalSection.singlesUpsetsByPlayer,
    generalSection.doublesUpsetsByPlayer,
    womenSection.singlesUpsetsByPlayer,
    womenSection.doublesUpsetsByPlayer,
  ]);
  const achievementInputs = matches
    .map((m) =>
      toAchievementMatchInput(m, id, giantKillerMatchIds.has(m.id), {
        sport: "tennis",
        womensOnly: womensOnlyTournamentIds.has(m.tournamentId),
      }),
    )
    .filter((m): m is AchievementMatchInput => m !== null);
  const achievements = buildPlayerAchievements(achievementInputs, {
    playerId: id,
    gender: player.gender,
    sport: "tennis",
  });

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

      <RatingClubSection title="Рейтинг клубу" section={generalSection} />
      {/* Only rendered when the player actually has a rating in the women's
          pool (see RatingClubSection) - most players never will, since it's
          scoped to isWomensOnly tournaments only. */}
      <RatingClubSection title="Жіночий рейтинг клубу" section={womenSection} poolParam="women" />

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
        {visibleMatches.map((match) => {
          // Each match's SET.club rank badge reads whichever pool that
          // match's OWN tournament actually belongs to (docs/RATING.md) -
          // not always the general pool, since a player's history can mix
          // both.
          const section = womensOnlyTournamentIds.has(match.tournament.id) ? womenSection : generalSection;
          return (
            <MatchSummary
              key={match.id}
              match={match}
              perspectivePlayerId={id}
              singlesRankById={section.singlesRankById}
              doublesRankById={section.doublesRankById}
            />
          );
        })}
      </div>
    </div>
  );
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
