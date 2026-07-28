import { TrophyIcon } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StandingsRow } from "@/lib/tournament-standings";
import { cn } from "@/lib/utils";

export function TournamentStandings({
  rows,
  showWinner,
  emptyMessage = "Учасників ще не додано.",
}: {
  rows: StandingsRow[];
  /** Highlight the top row as the winner (only meaningful once the tournament is COMPLETED). */
  showWinner: boolean;
  emptyMessage?: string;
}) {
  const hasWinner = showWinner && rows.length > 0 && rows[0].wins > 0;

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
