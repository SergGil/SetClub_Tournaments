import { LoadMore } from "@/components/load-more";
import { MatchesFilters, type StatusFilterSelection } from "@/components/matches-filters";
import { MatchSummary } from "@/components/match-summary";
import { formatDateUTC } from "@/lib/date-format";
import { parseShowParam } from "@/lib/load-more";
import { countLabel, MATCH_FORMS } from "@/lib/pluralize";
import { getMatchesPage, MATCH_STATUS_FILTER_VALUES, MATCHES_PAGE_SIZE } from "@/lib/queries/matches";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { getPlayers } from "@/lib/queries/players";
import { buildMatchPreview } from "@/lib/rating/match-preview";
import {
  getDoublesRatings,
  getSinglesRatings,
  getSinglesRatingSnapshotsByTournament,
} from "@/lib/rating/ratings-data";

export const metadata = { title: "Матчі" };

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

// UTC to match the timeZone the header itself is formatted in (see
// weekdayLabel below) and matchDayFilter's own UTC-day convention in
// lib/queries/matches.ts - not for hydration-safety here (this page has no
// client boundary above these headers), just consistency.
const weekdayFormatter = new Intl.DateTimeFormat("uk-UA", { weekday: "long", timeZone: "UTC" });

function weekdayLabel(date: Date): string {
  const weekday = weekdayFormatter.format(date);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

/**
 * Chunks consecutive matches sharing the same calendar day - `matches` is
 * already sorted newest-first (getMatchesPage), so same-day matches are
 * always adjacent and a single linear pass is enough, no need to bucket by
 * key first. Falls back to `createdAt` for matches with no `scheduledDate`,
 * the same convention `matchDayFilter` uses for the date filter.
 */
function groupMatchesByDay(matches: MatchWithDetails[]) {
  const groups: { key: string; label: string; matches: MatchWithDetails[] }[] = [];
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
  return `/matches?${params.toString()}`;
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; player?: string; date?: string; status?: string }>;
}) {
  const { show: showParam, player: playerParam, date: dateParam, status: statusParam } =
    await searchParams;
  const [players, singlesRatings, doublesRatings, singlesRatingSnapshots] = await Promise.all([
    getPlayers(),
    getSinglesRatings(),
    getDoublesRatings(),
    getSinglesRatingSnapshotsByTournament(),
  ]);

  const playerId = playerParam && players.some((p) => p.id === playerParam) ? playerParam : undefined;
  const date = dateParam && DATE_PARAM_RE.test(dateParam) ? dateParam : undefined;
  // No status param (or an unrecognized one) shows every status by default -
  // only an explicit "?status=SCHEDULED"/"?status=COMPLETED" narrows it.
  const selectedStatus: StatusFilterSelection =
    MATCH_STATUS_FILTER_VALUES.find((v) => v === statusParam) ?? "ALL";
  const status = selectedStatus === "ALL" ? undefined : selectedStatus;
  const shown = parseShowParam(showParam, MATCHES_PAGE_SIZE);

  const { matches, total } = await getMatchesPage(shown, { playerId, date, status });
  const hasFilter = Boolean(playerId || date || statusParam);
  const dayGroups = groupMatchesByDay(matches);

  const singlesRatingById = new Map(singlesRatings.map((r) => [r.playerId, r.rating]));
  const doublesRatingById = new Map(doublesRatings.map((r) => [r.playerId, r.rating]));
  const singlesRankById = Object.fromEntries(singlesRatings.map((r, i) => [r.playerId, i + 1]));
  const doublesRankById = Object.fromEntries(doublesRatings.map((r, i) => [r.playerId, i + 1]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Матчі</h1>
        <p className="text-sm text-foreground/80">{countLabel(total, MATCH_FORMS)}</p>
      </div>

      <MatchesFilters
        players={players.map((p) => ({ id: p.id, name: p.name }))}
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
            {group.matches.map((match) => (
              <MatchSummary
                key={match.id}
                match={match}
                preview={
                  match.status === "SCHEDULED"
                    ? buildMatchPreview(match, singlesRatingById, doublesRatingById)
                    : undefined
                }
                singlesRatingSnapshots={singlesRatingSnapshots}
                singlesRankById={singlesRankById}
                doublesRankById={doublesRankById}
              />
            ))}
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
        href={buildShowMoreHref(shown + MATCHES_PAGE_SIZE, playerId, date, selectedStatus)}
        label={`Показано ${matches.length} з ${countLabel(total, MATCH_FORMS)}`}
      />
    </div>
  );
}
