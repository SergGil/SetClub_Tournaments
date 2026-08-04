import { LoadMore } from "@/components/load-more";
import { MatchesFilters, type StatusFilterSelection } from "@/components/matches-filters";
import { MatchSummary } from "@/components/match-summary";
import { parseShowParam } from "@/lib/load-more";
import { countLabel, MATCH_FORMS } from "@/lib/pluralize";
import { getMatchesPage, MATCH_STATUS_FILTER_VALUES, MATCHES_PAGE_SIZE } from "@/lib/queries/matches";
import { getPlayers } from "@/lib/queries/players";
import { buildMatchPreview } from "@/lib/rating/match-preview";
import {
  getDoublesRatings,
  getSinglesRatings,
  getSinglesRatingSnapshotsByTournament,
} from "@/lib/rating/ratings-data";

export const metadata = { title: "Матчі" };

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  const singlesRatingById = new Map(singlesRatings.map((r) => [r.playerId, r.rating]));
  const doublesRatingById = new Map(doublesRatings.map((r) => [r.playerId, r.rating]));

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
        {matches.map((match) => (
          <MatchSummary
            key={match.id}
            match={match}
            preview={
              match.status === "SCHEDULED"
                ? buildMatchPreview(match, singlesRatingById, doublesRatingById)
                : undefined
            }
            singlesRatingSnapshots={singlesRatingSnapshots}
          />
        ))}
        {matches.length === 0 && (
          <p className="text-foreground/80">
            {hasFilter ? "Немає матчів за цим фільтром." : "Матчів ще немає."}
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
