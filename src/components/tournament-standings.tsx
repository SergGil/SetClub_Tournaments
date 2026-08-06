import { TrophyIcon } from "lucide-react";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import type { StandingsRow, TournamentStandingsResult } from "@/lib/tournament-standings";
import { cn } from "@/lib/utils";

// The seeded-split's two groups keep their original Gold/Silver colors;
// admin-assigned "Група N" groups get a plain heading (there isn't a
// meaningful color per group number).
const SEED_GROUP_STYLE: Record<string, { dot: string; text: string }> = {
  "Gold (сіяні)": { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  "Silver (несіяні)": { dot: "bg-slate-400", text: "text-slate-500 dark:text-slate-400" },
};

export function TournamentStandings({
  rows,
  showWinner,
  roundRobinDone = false,
  hasPlayoffFinal = false,
  emptyMessage = "Учасників ще не додано.",
}: {
  rows: StandingsRow[];
  /** Highlight the top row as the winner (only meaningful once the tournament is COMPLETED). */
  showWinner: boolean;
  /**
   * A round robin (this whole table, or one Gold/Silver bracket of it) can be
   * fully played - every row having faced every other row - before an admin
   * gets around to flipping the tournament's own status to COMPLETED. Callers
   * compute this from actual head-to-head results (see isRoundRobinComplete)
   * rather than match counts alone, since a duplicate match between the same
   * two rows could otherwise satisfy a count-only check.
   */
  roundRobinDone?: boolean;
  /** A Фінал playoff match decides the champion on its own - suppresses this table's trophy even if showWinner/roundRobinDone would otherwise show it, since the round-robin leader isn't necessarily who won the final. */
  hasPlayoffFinal?: boolean;
  emptyMessage?: string;
}) {
  const hasWinner =
    !hasPlayoffFinal && (showWinner || roundRobinDone) && rows.length > 0 && rows[0].wins > 0;

  if (rows.length === 0) {
    return <p className="text-sm text-foreground/80">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* table-fixed + explicit widths on every column - each group renders
          as its own separate <table>, so with the default auto layout every
          one sizes its "Гравець" column to its own longest name, shifting
          the numeric columns out of alignment between stacked group tables
          further down the page. Fixed widths keep every group's columns at
          the same position regardless of what names happen to be in it. */}
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="sticky left-0 z-10 w-40 bg-card">Гравець</TableHead>
            <TableHead className="w-16 text-right">Матчів</TableHead>
            <TableHead className="w-16 text-right">Перемог</TableHead>
            <TableHead className="w-16 text-right">Поразок</TableHead>
            <TableHead className="w-14 text-right">Очки</TableHead>
            <TableHead className="w-16 text-right">Геймів</TableHead>
            <TableHead className="w-20 text-right">% перемог</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.key} className={cn("group", index === 0 && hasWinner && "bg-amber-500/5")}>
              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
              <TableRowHeader
                className={cn(
                  "sticky left-0 z-10 w-40 overflow-hidden font-medium text-ellipsis whitespace-nowrap group-hover:bg-muted/50",
                  index === 0 && hasWinner
                    ? "bg-[color-mix(in_oklch,var(--color-amber-500)_5%,var(--card))]"
                    : "bg-card",
                )}
              >
                {row.href ? (
                  <Link href={row.href} className="flex items-center gap-1.5 hover:underline">
                    {row.label}
                    {index === 0 && hasWinner && (
                      <TrophyIcon className="size-3.5 text-amber-500" aria-label="Переможець" />
                    )}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {row.label}
                    {index === 0 && hasWinner && (
                      <TrophyIcon className="size-3.5 text-amber-500" aria-label="Переможець" />
                    )}
                  </span>
                )}
              </TableRowHeader>
              <TableCell className="text-right tabular-nums">{row.matchesPlayed}</TableCell>
              <TableCell className="text-right tabular-nums">{row.wins}</TableCell>
              <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{row.points}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {row.gamesWon}:{row.gamesLost}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.winPct}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Wraps TournamentStandings, splitting into multiple labeled brackets when the
 * standings came back grouped that way - an admin-assigned 1-6 round-robin
 * group split and/or a seeded ("Gold") / unseeded ("Silver") split, matching
 * the singles randomizer's "За групами"/"За сіяністю" strategies. A tournament
 * can use either, or both at once (shown as two independent sections, each
 * with its own heading, one below the other). Each bracket is ranked (and
 * gets its own top-row trophy) independently of the others.
 */
export function TournamentStandingsSection({
  standings,
  showWinner,
  hasPlayoffFinal = false,
  emptyMessage,
}: {
  standings: TournamentStandingsResult;
  showWinner: boolean;
  hasPlayoffFinal?: boolean;
  emptyMessage?: string;
}) {
  if (!standings.grouped) {
    return (
      <TournamentStandings
        rows={standings.rows}
        showWinner={showWinner}
        roundRobinDone={standings.roundRobinDone}
        hasPlayoffFinal={hasPlayoffFinal}
        emptyMessage={emptyMessage}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {standings.groupings.map((grouping, groupingIndex) => (
        <div key={grouping.title ?? groupingIndex} className="flex flex-col gap-6">
          {grouping.title && <h2 className="text-base font-semibold">{grouping.title}</h2>}
          {grouping.groups.map((group) => {
            const seedStyle = SEED_GROUP_STYLE[group.label];
            return (
              <div key={group.label} className="flex flex-col gap-2">
                <h3
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-semibold",
                    seedStyle?.text ?? "text-muted-foreground",
                  )}
                >
                  {seedStyle && <span className={cn("size-2 rounded-full", seedStyle.dot)} />}
                  {group.label}
                </h3>
                <TournamentStandings
                  rows={group.rows}
                  showWinner={showWinner}
                  roundRobinDone={group.roundRobinDone}
                  hasPlayoffFinal={hasPlayoffFinal}
                  emptyMessage="Матчів ще немає."
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
