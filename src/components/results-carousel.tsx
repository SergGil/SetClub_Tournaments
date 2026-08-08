"use client";

import Link from "next/link";

import { HorizontalScroller } from "@/components/horizontal-scroller";
import { Badge } from "@/components/ui/badge";
import { displayName } from "@/lib/player-display";
import type { MatchWithDetails } from "@/lib/queries/matches";

const MATCH_TYPE_LABEL = { SINGLES: "1×1", DOUBLES: "2×2" } as const;
const MATCH_TYPE_VARIANT = { SINGLES: "accent", DOUBLES: "teal" } as const;

/** Winner-perspective names (one per teammate, not joined - so a long partner name truncates on its own line instead of hiding the other teammate) and per-set score. */
function winnerLoserSummary(match: MatchWithDetails) {
  const winnerSide = match.winnerSide as "A" | "B";
  const loserSide = winnerSide === "A" ? "B" : "A";
  const winners = match.players
    .filter((p) => p.side === winnerSide)
    .map((p) => ({ playerId: p.playerId, name: displayName(p.player) }));
  const losers = match.players
    .filter((p) => p.side === loserSide)
    .map((p) => ({ playerId: p.playerId, name: displayName(p.player) }));
  const scoreLine = match.sets
    .map((set) =>
      winnerSide === "A" ? `${set.sideAGames}:${set.sideBGames}` : `${set.sideBGames}:${set.sideAGames}`,
    )
    .join(" ");
  return { winners, losers, scoreLine };
}

// Explicit UTC extraction, not toLocaleDateString: this whole component is
// a Client Component (it hydrates) - toLocaleDateString would format using
// the server's local timezone during SSR but the browser's local timezone
// during hydration, producing a mismatched string whenever those differ
// (e.g. Vercel's UTC vs. a Ukraine-timezone visitor). Same fix as
// RatingHistoryChart's dateLabel on the player profile.
function shortDateLabel(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

function ResultTile({ match }: { match: MatchWithDetails }) {
  const { winners, losers, scoreLine } = winnerLoserSummary(match);
  return (
    <Link
      href={`/tournaments/${match.tournament.id}`}
      className="flex w-44 shrink-0 snap-start scroll-ml-3 flex-col gap-2 rounded-lg border bg-card p-3 text-xs transition-colors hover:border-primary"
    >
      <div className="flex items-center justify-between">
        <Badge variant={MATCH_TYPE_VARIANT[match.matchType]}>{MATCH_TYPE_LABEL[match.matchType]}</Badge>
        {(match.scheduledDate ?? match.completedAt) && (
          <span className="text-muted-foreground">
            {shortDateLabel(match.scheduledDate ?? match.completedAt!)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div>
          {winners.map((p) => (
            <p key={p.playerId} className="truncate font-medium">
              {p.name}
            </p>
          ))}
        </div>
        <div>
          {losers.map((p) => (
            <p key={p.playerId} className="truncate text-muted-foreground">
              {p.name}
            </p>
          ))}
        </div>
      </div>
      <p className="tabular-nums text-muted-foreground">{scoreLine}</p>
    </Link>
  );
}

export function ResultsCarousel({ matches }: { matches: MatchWithDetails[] }) {
  return (
    <HorizontalScroller>
      {matches.map((match) => (
        <ResultTile key={match.id} match={match} />
      ))}
    </HorizontalScroller>
  );
}
