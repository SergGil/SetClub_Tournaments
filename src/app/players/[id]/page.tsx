import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { OpponentFilter } from "@/components/opponent-filter";
import { PillFilterGroup, PillFilterLink } from "@/components/pill-filter";
import { RatingHistoryChart } from "@/components/rating-history-chart";
import { StatCard } from "@/components/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { countLabel, LOSS_FORMS, MATCH_FORMS, pluralizeUk, POINT_FORMS, WIN_FORMS } from "@/lib/pluralize";
import { displayName, fullDisplayName } from "@/lib/player-display";
import { summarizePlayerStats } from "@/lib/player-stats";
import type { MatchPlayerRow } from "@/lib/player-stats";
import { getPlayerMatches } from "@/lib/queries/matches";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { getPlayerById } from "@/lib/queries/players";
import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";
import {
  getDoublesRatings,
  getDoublesSetClubPoints,
  getPlayerRatingHistory,
  getSinglesRatings,
  getSinglesSetClubPoints,
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
 * as either - undecided (no winnerSide yet), or the withdrawn side of a
 * walkover, which summarizePlayerStats also excludes entirely rather than
 * charging a personal loss for a match never played (docs/WITHDRAWAL.md).
 * Mirrors summarizePlayerStats's own decidedRows filter exactly, so the
 * win/loss stat tiles and the list they filter always agree on the count.
 */
function matchResultForPlayer(match: MatchWithDetails, playerId: string): "win" | "loss" | null {
  const side = ownSide(match, playerId);
  if (!side || match.winnerSide === null) return null;
  if (match.walkover && match.winnerSide !== side) return null;
  return match.winnerSide === side ? "win" : "loss";
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
  searchParams: Promise<{ opponent?: string; result?: string; type?: string; year?: string }>;
}) {
  const { id } = await params;
  const { opponent: opponentId, result: resultParam, type: typeParam, year: yearParam } = await searchParams;
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
  ]);

  const singlesRank = singlesRatings.findIndex((row) => row.playerId === id);
  const doublesRank = doublesRatings.findIndex((row) => row.playerId === id);
  const singlesSetClubRank = singlesSetClubPoints.findIndex((row) => row.playerId === id);
  const doublesSetClubRank = doublesSetClubPoints.findIndex((row) => row.playerId === id);
  // Match cards below show SET.club rank/points, not the Glicko-2/OpenSkill
  // ones used for singlesRank/doublesRank above (those only feed the "Рейтинг
  // клубу" cards' own official-model numbers).
  const singlesRankById = Object.fromEntries(singlesSetClubPoints.map((r, i) => [r.playerId, i + 1]));
  const doublesRankById = Object.fromEntries(doublesSetClubPoints.map((r, i) => [r.playerId, i + 1]));

  const singlesRatingCard =
    singlesRank >= 0
      ? {
          rating: Math.round(conservativeRating(singlesRatings[singlesRank].rating)),
          spread: Math.round(singlesRatings[singlesRank].rating.rd),
          rank: singlesRank + 1,
          total: singlesRatings.length,
          setClub:
            singlesSetClubRank >= 0
              ? {
                  points: singlesSetClubPoints[singlesSetClubRank].points,
                  rank: singlesSetClubRank + 1,
                  total: singlesSetClubPoints.length,
                }
              : null,
        }
      : null;
  const doublesRatingCard =
    doublesRank >= 0
      ? {
          rating: Math.round(conservativeOrdinal(doublesRatings[doublesRank].rating)),
          spread: Math.round(displaySpread(doublesRatings[doublesRank].rating.sigma)),
          rank: doublesRank + 1,
          total: doublesRatings.length,
          setClub:
            doublesSetClubRank >= 0
              ? {
                  points: doublesSetClubPoints[doublesSetClubRank].points,
                  rank: doublesSetClubRank + 1,
                  total: doublesSetClubPoints.length,
                }
              : null,
        }
      : null;

  const opponentNameById = new Map<string, string>();
  for (const match of matches) {
    const own = ownSide(match, id);
    if (!own) continue;
    for (const p of match.players) {
      if (p.side !== own) opponentNameById.set(p.playerId, displayName(p.player));
    }
  }
  const opponents = Array.from(opponentNameById, ([opponentPlayerId, name]) => ({
    id: opponentPlayerId,
    name,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const selectedOpponent = opponentId ? opponents.find((o) => o.id === opponentId) : undefined;
  const opponentFilteredMatches = selectedOpponent
    ? matches.filter((m) => playedAgainst(m, id, selectedOpponent.id))
    : matches;
  // Result filter is separate from (and doesn't affect) the head-to-head
  // summary below - that always reflects the full record against this
  // opponent, only the match list itself narrows to just wins or losses.
  const resultFilteredMatches = selectedResult
    ? opponentFilteredMatches.filter((m) => matchResultForPlayer(m, id) === selectedResult)
    : opponentFilteredMatches;
  // Format/year years scoped to the win/loss view are only offered once a
  // result is selected (see the PillFilterGroups below) - available years
  // are computed from the player's own decided matches, not the club-wide
  // getResultYears (src/lib/stats.ts), which isn't scoped to one player.
  const resultYears = Array.from(
    new Set(
      opponentFilteredMatches
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

  function profileHref(
    overrides: {
      opponent?: string;
      result?: "win" | "loss";
      type?: "SINGLES" | "DOUBLES";
      year?: number;
    } = {},
  ) {
    const opponent = "opponent" in overrides ? overrides.opponent : selectedOpponent?.id;
    const result = "result" in overrides ? overrides.result : selectedResult;
    const type = "type" in overrides ? overrides.type : selectedType;
    const year = "year" in overrides ? overrides.year : activeYear;
    const params = new URLSearchParams();
    if (opponent) params.set("opponent", opponent);
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
          <h1 className="text-2xl font-bold tracking-tight">{fullDisplayName(player)}</h1>
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
        <StatCard label="% перемог" value={`${stats.winPct}%`} />
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {selectedOpponent ? `Особисті зустрічі: ${selectedOpponent.name}` : "Історія матчів"}
            {selectedResult && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({selectedResult === "win" ? "лише перемоги" : "лише поразки"})
              </span>
            )}
          </h2>
          {opponents.length > 0 && (
            <OpponentFilter
              opponents={opponents}
              selectedId={selectedOpponent?.id ?? ""}
              result={selectedResult}
              type={selectedType}
              year={activeYear}
            />
          )}
        </div>

        {selectedOpponent && h2hStats && h2hStats.matchesPlayed > 0 && (
          <p className="text-sm text-foreground/80">
            <span className="tabular-nums">
              <span className="text-foreground">{h2hStats.wins}</span>–{h2hStats.losses}
            </span>{" "}
            ({countLabel(h2hStats.matchesPlayed, MATCH_FORMS)} із визначеним переможцем)
          </p>
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
  total,
  setClub,
  history,
}: {
  format: "singles" | "doubles";
  label: string;
  badgeVariant: "accent" | "teal";
  badgeLabel: string;
  rating: number;
  spread: number;
  rank: number;
  total: number;
  setClub: { points: number; rank: number; total: number } | null;
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
              <p className="text-sm tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground"># {rank}</span> з {total} гравців
              </p>
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
