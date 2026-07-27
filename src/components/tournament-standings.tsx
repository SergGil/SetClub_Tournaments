import { TrophyIcon } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PlayerStats } from "@/lib/stats";
import { cn } from "@/lib/utils";

export function TournamentStandings({
  participants,
  standings,
  showWinner,
}: {
  participants: { playerId: string; player: { id: string; name: string } }[];
  standings: Map<string, PlayerStats>;
  /** Highlight the top row as the winner (only meaningful once the tournament is COMPLETED). */
  showWinner: boolean;
}) {
  const rows = participants
    .map((entry) => {
      const s = standings.get(entry.playerId);
      return {
        playerId: entry.playerId,
        name: entry.player.name,
        matchesPlayed: s?.matchesPlayed ?? 0,
        wins: s?.wins ?? 0,
        losses: s?.losses ?? 0,
        winPct: s?.winPct ?? 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || a.name.localeCompare(b.name));

  const hasWinner = showWinner && rows.length > 0 && rows[0].wins > 0;

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Учасників ще не додано.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Гравець</TableHead>
            <TableHead className="text-right">Матчів</TableHead>
            <TableHead className="text-right">Перемог</TableHead>
            <TableHead className="text-right">Поразок</TableHead>
            <TableHead className="text-right">% перемог</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.playerId} className={cn(index === 0 && hasWinner && "bg-amber-500/5")}>
              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/players/${row.playerId}`}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  {row.name}
                  {index === 0 && hasWinner && (
                    <TrophyIcon className="size-3.5 text-amber-500" aria-label="Переможець" />
                  )}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.matchesPlayed}</TableCell>
              <TableCell className="text-right tabular-nums">{row.wins}</TableCell>
              <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
              <TableCell className="text-right tabular-nums">{row.winPct}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
