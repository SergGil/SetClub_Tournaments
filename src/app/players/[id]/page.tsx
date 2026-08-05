import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { OpponentFilter } from "@/components/opponent-filter";
import { RatingHistoryChart } from "@/components/rating-history-chart";
import { StatCard } from "@/components/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { countLabel, LOSS_FORMS, MATCH_FORMS, pluralizeUk, WIN_FORMS } from "@/lib/pluralize";
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
  getSetClubSeasons,
  getSinglesRatings,
  getSinglesRatingSnapshotsByTournament,
  getSinglesSetClubPoints,
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayerById(id);
  return { title: player?.name ?? "Гравець" };
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opponent?: string }>;
}) {
  const { id } = await params;
  const { opponent: opponentId } = await searchParams;
  const player = await getPlayerById(id);
  if (!player) notFound();

  const [
    stats,
    matches,
    singlesRatings,
    doublesRatings,
    singlesSeasons,
    doublesSeasons,
    singlesHistory,
    doublesHistory,
    singlesRatingSnapshots,
  ] = await Promise.all([
    getPlayerStats(id),
    getPlayerMatches(id),
    getSinglesRatings(),
    getDoublesRatings(),
    getSetClubSeasons("SINGLES"),
    getSetClubSeasons("DOUBLES"),
    getPlayerRatingHistory(id, "SINGLES"),
    getPlayerRatingHistory(id, "DOUBLES"),
    getSinglesRatingSnapshotsByTournament(),
  ]);

  // Set Club points reset every season - show the player's most recent season, same default as /rating.
  const singlesSetClubSeason = singlesSeasons[0];
  const doublesSetClubSeason = doublesSeasons[0];
  const [singlesSetClubPoints, doublesSetClubPoints] = await Promise.all([
    singlesSetClubSeason ? getSinglesSetClubPoints(singlesSetClubSeason) : Promise.resolve([]),
    doublesSetClubSeason ? getDoublesSetClubPoints(doublesSetClubSeason) : Promise.resolve([]),
  ]);

  const singlesRank = singlesRatings.findIndex((row) => row.playerId === id);
  const doublesRank = doublesRatings.findIndex((row) => row.playerId === id);
  const singlesRankById = Object.fromEntries(singlesRatings.map((r, i) => [r.playerId, i + 1]));
  const doublesRankById = Object.fromEntries(doublesRatings.map((r, i) => [r.playerId, i + 1]));
  const singlesSetClubRank = singlesSetClubPoints.findIndex((row) => row.playerId === id);
  const doublesSetClubRank = doublesSetClubPoints.findIndex((row) => row.playerId === id);

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
      if (p.side !== own) opponentNameById.set(p.playerId, p.player.name);
    }
  }
  const opponents = Array.from(opponentNameById, ([opponentPlayerId, name]) => ({
    id: opponentPlayerId,
    name,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const selectedOpponent = opponentId ? opponents.find((o) => o.id === opponentId) : undefined;
  const visibleMatches = selectedOpponent
    ? matches.filter((m) => playedAgainst(m, id, selectedOpponent.id))
    : matches;

  const h2hRows: MatchPlayerRow[] = selectedOpponent
    ? visibleMatches
        .filter((m) => m.status === "COMPLETED" && m.winnerSide !== null)
        .map((m) => ({
          side: ownSide(m, id)!,
          match: { winnerSide: m.winnerSide, sets: m.sets, tournamentId: m.tournament.id },
        }))
    : [];
  const h2hStats = selectedOpponent ? summarizePlayerStats(id, h2hRows) : null;

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
          <h1 className="text-2xl font-bold tracking-tight">{player.name}</h1>
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
        <StatCard label={capitalize(pluralizeUk(stats.matchesPlayed, MATCH_FORMS))} value={stats.matchesPlayed} />
        <StatCard label={capitalize(pluralizeUk(stats.wins, WIN_FORMS))} value={stats.wins} tone="positive" />
        <StatCard label={capitalize(pluralizeUk(stats.losses, LOSS_FORMS))} value={stats.losses} tone="negative" />
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
          </h2>
          {opponents.length > 0 && (
            <OpponentFilter opponents={opponents} selectedId={selectedOpponent?.id ?? ""} />
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

        {visibleMatches.length === 0 && <p className="text-foreground/80">Матчів ще немає.</p>}
        {visibleMatches.map((match) => (
          <MatchSummary
            key={match.id}
            match={match}
            perspectivePlayerId={id}
            singlesRatingSnapshots={singlesRatingSnapshots}
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
                  <span className="ml-1 text-xs font-normal text-muted-foreground">балів</span>
                </p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground"># {setClub.rank}</span> з {setClub.total}{" "}
                  гравців
                </p>
              </div>
              <Badge variant="orange">Set Club</Badge>
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
