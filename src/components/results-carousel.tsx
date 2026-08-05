"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { cn } from "@/lib/utils";

const MATCH_TYPE_LABEL = { SINGLES: "1×1", DOUBLES: "2×2" } as const;
const MATCH_TYPE_VARIANT = { SINGLES: "accent", DOUBLES: "teal" } as const;

const SCROLL_STEP_PX = 280;

/** Winner-perspective names (one per teammate, not joined - so a long partner name truncates on its own line instead of hiding the other teammate) and per-set score. */
function winnerLoserSummary(match: MatchWithDetails) {
  const winnerSide = match.winnerSide as "A" | "B";
  const loserSide = winnerSide === "A" ? "B" : "A";
  const winners = match.players
    .filter((p) => p.side === winnerSide)
    .map((p) => ({ playerId: p.playerId, name: p.player.name }));
  const losers = match.players
    .filter((p) => p.side === loserSide)
    .map((p) => ({ playerId: p.playerId, name: p.player.name }));
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

/**
 * Horizontal scroller with edge fades + arrow buttons that fade/disable at
 * the start/end - plain CSS scroll-snap alone (the old implementation) gives
 * no visible cue that there's more to see, and a mouse wheel scrolls the
 * page vertically rather than this row, so desktop visitors without a
 * trackpad had no discoverable way to see the rest.
 */
export function ResultsCarousel({ matches }: { matches: MatchWithDetails[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function updateEdges() {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 0);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }

  function scrollByStep(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
      >
        {matches.map((match) => (
          <ResultTile key={match.id} match={match} />
        ))}
      </div>
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity",
          atStart ? "opacity-0" : "opacity-100",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity",
          atEnd ? "opacity-0" : "opacity-100",
        )}
      />
      <button
        type="button"
        aria-label="Прокрутити ліворуч"
        onClick={() => scrollByStep(-1)}
        disabled={atStart}
        className="absolute top-1/2 left-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border bg-card shadow-sm transition-opacity hover:bg-muted disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Прокрутити праворуч"
        onClick={() => scrollByStep(1)}
        disabled={atEnd}
        className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border bg-card shadow-sm transition-opacity hover:bg-muted disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
