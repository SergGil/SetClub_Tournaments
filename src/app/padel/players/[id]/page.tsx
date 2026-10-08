import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { PlayerAchievements } from "@/components/player-achievements";
import { PlayerMatchHistory, PlayerProfileHeader, PlayerStatCards } from "@/components/player-profile-sections";
import { RatingClubSection } from "@/components/player-rating-section";
import { Card, CardContent } from "@/components/ui/card";
import { findBestPartner } from "@/lib/best-partner";
import { getPadelPlayerStats } from "@/lib/padel-stats";
import { loadPlayerAchievements } from "@/lib/player-achievements-data";
import { fullDisplayName } from "@/lib/player-display";
import { buildProfileView } from "@/lib/player-profile";
import type { ProfileQuery } from "@/lib/player-profile";
import { getPlayerPadelMatches } from "@/lib/queries/padel-matches";
import { getPadelWomensOnlyTournamentIds } from "@/lib/queries/padel-tournaments";
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
import { buildPlayerRatingSection, EMPTY_PLAYER_RATING_SECTION } from "@/lib/rating/player-rating-data";
import type { PlayerRatingSection } from "@/lib/rating/player-rating-data";
import type { RatingScope } from "@/lib/rating/rating-pools";

/**
 * Padel twin of the Tennis profile (src/app/players/[id]/page.tsx), scoped to padel only: padel
 * record, padel ratings (Glicko-2/OpenSkill + SET.club), best partner, padel-only achievements
 * and match history from padel matches. The header, stat tiles and filtered match history are
 * the same shared components (components/player-profile-sections.tsx) the Tennis profile uses;
 * the women's rating section shows only when the player has one.
 */

/**
 * Everything the profile's "Рейтинг клубу" block needs for ONE padel rating pool (see
 * RatingScope) - called once for "general" and once for "women" so a player whose padel matches
 * are all in women-only tournaments still gets a rating card (docs/RATING.md), and so each match
 * below can show the SET.club rank of the pool its own tournament belongs to.
 */
async function fetchPadelRatingSection(playerId: string, scope: RatingScope): Promise<PlayerRatingSection> {
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
    getPadelSinglesRatings(scope),
    getPadelDoublesRatings(scope),
    getPlayerPadelRatingHistory(playerId, "SINGLES", scope),
    getPlayerPadelRatingHistory(playerId, "DOUBLES", scope),
    // SET.club badge shows the same rolling-52-week default as /padel/rating.
    getPadelSinglesSetClubPoints(PADEL_ROLLING_SEASON, scope),
    getPadelDoublesSetClubPoints(PADEL_ROLLING_SEASON, scope),
    getPadelSinglesRatingsTrend(scope),
    getPadelDoublesRatingsTrend(scope),
    getPadelSinglesSetClubTrend(PADEL_ROLLING_SEASON, scope),
    getPadelDoublesSetClubTrend(PADEL_ROLLING_SEASON, scope),
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
  return { title: player ? `${fullDisplayName(player)} — Падел` : "Гравець" };
}

export default async function PadelPlayerProfilePage({
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
    getPadelPlayerStats(id),
    getPlayerPadelMatches(id),
    fetchPadelRatingSection(id, "general"),
    getPadelWomensOnlyTournamentIds(),
  ]);
  // The women's pool is built only from women-only tournaments, so a player appears in it
  // iff they played in one - skip its club-wide replays for everyone else.
  const hasWomensTournamentMatch = matches.some((m) => womensOnlyTournamentIds.has(m.tournament.id));
  // Neither depends on the other, so they load together. Achievements here are padel-only
  // (docs/ACHIEVEMENTS.md) - the other sport's profile shows its own.
  const [womenSection, achievements] = await Promise.all([
    hasWomensTournamentMatch ? fetchPadelRatingSection(id, "women") : Promise.resolve(EMPTY_PLAYER_RATING_SECTION),
    loadPlayerAchievements({
      sport: "padel",
      playerId: id,
      gender: player.gender,
      matches,
      womensOnlyTournamentIds,
    }),
  ]);

  const bestPartner = findBestPartner(matches, id);
  const view = buildProfileView(matches, id, query, `/padel/players/${id}`);
  const visibleMatches = view.visibleMatches as typeof matches;

  return (
    <div className="flex flex-col gap-6">
      <PlayerProfileHeader
        player={player}
        stats={stats}
        backHref="/padel/players"
        backLabel="← Усі гравці падела"
        noMatchesLabel="Ще немає жодного матчу в падел"
      />

      <PlayerAchievements achievements={achievements} />

      <PlayerStatCards stats={stats} view={view} />

      <RatingClubSection title="Рейтинг клубу (падел)" section={generalSection} basePath="/padel/rating" />
      {/* Only rendered when the player actually has a rating in the women's pool (see
          RatingClubSection) - scoped to women-only padel tournaments. */}
      <RatingClubSection
        title="Жіночий рейтинг клубу (падел)"
        section={womenSection}
        poolParam="women"
        basePath="/padel/rating"
      />

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

      <PlayerMatchHistory player={player} view={view} visibleCount={visibleMatches.length}>
        {visibleMatches.map((match) => {
          // Each match's SET.club rank badge reads the pool its OWN tournament belongs to.
          const section = womensOnlyTournamentIds.has(match.tournament.id) ? womenSection : generalSection;
          return (
            <MatchSummary
              key={match.id}
              match={match}
              sport="PADEL"
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
