import { TrophyIcon } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StandingsRow, TournamentStandingsResult } from "@/lib/tournament-standings";
import { cn } from "@/lib/utils";

export function TournamentStandings({
  rows,
  showWinner,
  roundRobinDone = false,
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
  emptyMessage?: string;
}) {
  const hasWinner = (showWinner || roundRobinDone) && rows.length > 0 && rows[0].wins > 0;

  if (rows.length === 0) {
    return <p className="text-sm text-foreground/80">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Гравець</TableHead>
            <TableHead className="text-right">Матчів</TableHead>
            <TableHead className="text-right">Перемог</TableHead>
            <TableHead className="text-right">Поразок</TableHead>
            <TableHead className="text-right">Геймів</TableHead>
            <TableHead className="text-right">% перемог</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.key} className={cn(index === 0 && hasWinner && "bg-amber-500/5")}>
              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-medium">
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
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.matchesPlayed}</TableCell>
              <TableCell className="text-right tabular-nums">{row.wins}</TableCell>
              <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
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
  emptyMessage,
}: {
  standings: TournamentStandingsResult;
  showWinner: boolean;
  emptyMessage?: string;
}) {
  if (!standings.grouped) {
    return (
      <TournamentStandings
        rows={standings.rows}
        showWinner={showWinner}
        roundRobinDone={standings.roundRobinDone}
        emptyMessage={emptyMessage}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {standings.groupings.map((grouping, groupingIndex) => (
        <div key={grouping.title ?? groupingIndex} className="flex flex-col gap-6">
          {grouping.title && <h2 className="text-base font-semibold">{grouping.title}</h2>}
          {grouping.groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
              <TournamentStandings
                rows={group.rows}
                showWinner={showWinner}
                roundRobinDone={group.roundRobinDone}
                emptyMessage="Матчів ще немає."
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
