import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { PlayerAchievements } from "@/components/player-achievements";
import { PlayerMatchHistory, PlayerProfileHeader, PlayerStatCards } from "@/components/player-profile-sections";
import { RatingClubSection } from "@/components/player-rating-section";
import { Card, CardContent } from "@/components/ui/card";
import { findBestPartner } from "@/lib/best-partner";
import { loadPlayerAchievements } from "@/lib/player-achievements-data";
import { fullDisplayName } from "@/lib/player-display";
import { buildProfileView } from "@/lib/player-profile";
import type { ProfileQuery } from "@/lib/player-profile";
import { getPlayerMatches } from "@/lib/queries/matches";
import { getPlayerById } from "@/lib/queries/players";
import { getWomensOnlyTournamentIds } from "@/lib/queries/tournaments";
import { buildPlayerRatingSection, EMPTY_PLAYER_RATING_SECTION } from "@/lib/rating/player-rating-data";
import type { PlayerRatingSection } from "@/lib/rating/player-rating-data";
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
  ROLLING_SEASON,
} from "@/lib/rating/ratings-data";
import type { RatingScope } from "@/lib/rating/ratings-data";
import { getPlayerStats } from "@/lib/stats";

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
  ]);
  return buildPlayerRatingSection(playerId, {
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
  });
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
  searchParams: Promise<ProfileQuery>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const player = await getPlayerById(id);
  if (!player) notFound();

  const [stats, matches, generalSection, womensOnlyTournamentIds] = await Promise.all([
    getPlayerStats(id),
    getPlayerMatches(id),
    fetchPlayerRatingSection(id, "general"),
    getWomensOnlyTournamentIds(),
  ]);
  // The women's pool is built only from women-only tournaments, so a player appears in it
  // (rating card, history, match rank badges) iff they played in one - skip its club-wide
  // replays entirely for everyone else, which is nearly every profile view.
  const hasWomensTournamentMatch = matches.some((m) => womensOnlyTournamentIds.has(m.tournament.id));
  const womenSection = hasWomensTournamentMatch
    ? await fetchPlayerRatingSection(id, "women")
    : EMPTY_PLAYER_RATING_SECTION;

  // Achievements on this profile are tennis-only (docs/ACHIEVEMENTS.md) - the padel profile
  // (/padel/players/[id]) shows the padel ones, computed the same way from padel matches.
  const achievements = await loadPlayerAchievements({
    sport: "tennis",
    playerId: id,
    gender: player.gender,
    matches,
    womensOnlyTournamentIds,
  });

  const bestPartner = findBestPartner(matches, id);
  const view = buildProfileView(matches, id, query, `/players/${id}`);
  const visibleMatches = view.visibleMatches as typeof matches;

  return (
    <div className="flex flex-col gap-6">
      <PlayerProfileHeader
        player={player}
        stats={stats}
        backHref="/players"
        backLabel="← Усі гравці"
        noMatchesLabel="Ще немає жодного матчу"
      />

      <PlayerAchievements achievements={achievements} />

      <PlayerStatCards stats={stats} view={view} />

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

      <PlayerMatchHistory player={player} view={view} visibleCount={visibleMatches.length}>
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
      </PlayerMatchHistory>
    </div>
  );
}
