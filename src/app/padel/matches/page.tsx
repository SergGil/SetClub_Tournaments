import { LoadMore } from "@/components/load-more";
import { MatchesFilters, type StatusFilterSelection } from "@/components/matches-filters";
import { MatchSummary } from "@/components/match-summary";
import { PageHeroGlow } from "@/components/page-hero-glow";
import { formatDateUTC } from "@/lib/date-format";
import { parseShowParam } from "@/lib/load-more";
import { countLabel, MATCH_FORMS } from "@/lib/pluralize";
import { displayName } from "@/lib/player-display";
import { getPadelWomensOnlyTournamentIds } from "@/lib/queries/padel-tournaments";
import { getPlayers } from "@/lib/queries/players";
import {
  getPadelMatchesPage,
  PADEL_MATCHES_PAGE_SIZE,
  PADEL_MATCH_STATUS_FILTER_VALUES,
} from "@/lib/queries/padel-matches";
import type { PadelMatchWithDetails } from "@/lib/queries/padel-matches";
import { buildMatchPreview } from "@/lib/rating/match-preview";
import {
  getPadelDoublesRatings,
  getPadelDoublesSetClubPoints,
  getPadelSinglesRatings,
  getPadelSinglesSetClubPoints,
  PADEL_ROLLING_SEASON,
} from "@/lib/rating/padel-ratings-data";
import type { RatingScope } from "@/lib/rating/ratings-data";

export const metadata = { title: "Матчі (Падел)" };

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

const weekdayFormatter = new Intl.DateTimeFormat("uk-UA", { weekday: "long", timeZone: "UTC" });

function weekdayLabel(date: Date): string {
  const weekday = weekdayFormatter.format(date);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function groupMatchesByDay(matches: PadelMatchWithDetails[]) {
  const groups: { key: string; label: string; matches: PadelMatchWithDetails[] }[] = [];
  for (const match of matches) {
    const date = match.scheduledDate ?? match.createdAt;
    const key = formatDateUTC(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.matches.push(match);
    } else {
      groups.push({ key, label: `${weekdayLabel(date)}, ${key}`, matches: [match] });
    }
  }
  return groups;
}

/**
 * Ratings/SET.club points for one padel rating pool (see RatingScope) - called once for
 * "general" and once for "women" so each match's win-probability preview and SET.club rank
 * badge read whichever pool that match's OWN tournament belongs to (docs/RATING.md), same as
 * /matches.
 */
async function fetchMatchesRatingData(scope: RatingScope) {
  const [singlesRatings, doublesRatings, singlesSetClubPoints, doublesSetClubPoints] = await Promise.all([
    getPadelSinglesRatings(scope),
    getPadelDoublesRatings(scope),
    getPadelSinglesSetClubPoints(PADEL_ROLLING_SEASON, scope),
    getPadelDoublesSetClubPoints(PADEL_ROLLING_SEASON, scope),
  ]);
  return {
    singlesRatingById: new Map(singlesRatings.map((r) => [r.playerId, r.rating])),
    doublesRatingById: new Map(doublesRatings.map((r) => [r.playerId, r.rating])),
    singlesPointsById: new Map(singlesSetClubPoints.map((r) => [r.playerId, r.points])),
    doublesPointsById: new Map(doublesSetClubPoints.map((r) => [r.playerId, r.points])),
    singlesRankById: Object.fromEntries(singlesSetClubPoints.map((r, i) => [r.playerId, i + 1])),
    doublesRankById: Object.fromEntries(doublesSetClubPoints.map((r, i) => [r.playerId, i + 1])),
  };
}

function buildShowMoreHref(
  shown: number,
  playerId: string | undefined,
  date: string | undefined,
  status: StatusFilterSelection,
): string {
  const params = new URLSearchParams();
  if (playerId) params.set("player", playerId);
  if (date) params.set("date", date);
  params.set("status", status);
  params.set("show", String(shown));
  return `/padel/matches?${params.toString()}`;
}

export default async function PadelMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; player?: string; date?: string; status?: string }>;
}) {
  const { show: showParam, player: playerParam, date: dateParam, status: statusParam } =
    await searchParams;
  const [players, generalRatingData, womenRatingData, womensOnlyTournamentIds] = await Promise.all([
    getPlayers(),
    fetchMatchesRatingData("general"),
    fetchMatchesRatingData("women"),
    getPadelWomensOnlyTournamentIds(),
  ]);

  const playerId = playerParam && players.some((p) => p.id === playerParam) ? playerParam : undefined;
  const date = dateParam && DATE_PARAM_RE.test(dateParam) ? dateParam : undefined;
  const selectedStatus: StatusFilterSelection =
    PADEL_MATCH_STATUS_FILTER_VALUES.find((v) => v === statusParam) ?? "ALL";
  const status = selectedStatus === "ALL" ? undefined : selectedStatus;
  const shown = parseShowParam(showParam, PADEL_MATCHES_PAGE_SIZE);

  const { matches, total } = await getPadelMatchesPage(shown, { playerId, date, status });
  const hasFilter = Boolean(playerId || date || statusParam);
  const dayGroups = groupMatchesByDay(matches);


  return (
    <div className="flex flex-col gap-6">
      <PageHeroGlow variant="padel" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Матчі (Падел)
        </h1>
        <p className="text-sm text-foreground/80">{countLabel(total, MATCH_FORMS)}</p>
      </div>

      <MatchesFilters
        players={players.map((p) => ({ id: p.id, name: displayName(p) }))}
        selectedPlayerId={playerId}
        selectedDate={date}
        selectedStatus={selectedStatus}
      />

      <div className="flex flex-col gap-2">
        {dayGroups.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            {dayGroups.length > 1 && (
              <h2 className="sticky top-0 z-10 bg-background/95 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm">
                {group.label}
              </h2>
            )}
            {group.matches.map((match) => {
              // Each match reads whichever rating pool its OWN tournament belongs to
              // (docs/RATING.md) - this feed mixes matches from both pools.
              const ratingData = womensOnlyTournamentIds.has(match.tournament.id) ? womenRatingData : generalRatingData;
              return (
                <MatchSummary
                  key={match.id}
                  match={match}
                  sport="PADEL"
                  preview={
                    match.status === "SCHEDULED"
                      ? buildMatchPreview(
                          match,
                          ratingData.singlesRatingById,
                          ratingData.doublesRatingById,
                          ratingData.singlesPointsById,
                          ratingData.doublesPointsById,
                        )
                      : undefined
                  }
                  singlesRankById={ratingData.singlesRankById}
                  doublesRankById={ratingData.doublesRankById}
                />
              );
            })}
          </div>
        ))}
        {matches.length === 0 && (
          <p className="text-foreground/80">
            {hasFilter ? "Немає матчів за цим фільтром." : "Ще немає жодного матчу."}
          </p>
        )}
      </div>

      <LoadMore
        shown={matches.length}
        total={total}
        href={buildShowMoreHref(shown + PADEL_MATCHES_PAGE_SIZE, playerId, date, selectedStatus)}
        label={`Показано ${matches.length} з ${countLabel(total, MATCH_FORMS)}`}
      />
    </div>
  );
}
