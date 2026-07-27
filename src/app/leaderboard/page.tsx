import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlayers } from "@/lib/queries/players";
import { getAllPlayerStats } from "@/lib/stats";

export const metadata = { title: "Рейтинг" };

export default async function LeaderboardPage() {
  const [players, stats] = await Promise.all([getPlayers(), getAllPlayerStats()]);

  const rows = players
    .map((player) => {
      const s = stats.get(player.id);
      return {
        id: player.id,
        name: player.name,
        matchesPlayed: s?.matchesPlayed ?? 0,
        wins: s?.wins ?? 0,
        losses: s?.losses ?? 0,
        winPct: s?.winPct ?? 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Загальний рейтинг</h1>
        <p className="text-sm text-muted-foreground">Результати за всю історію клубу.</p>
      </div>

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
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-medium">
                <Link href={`/players/${row.id}`} className="hover:underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.matchesPlayed}</TableCell>
              <TableCell className="text-right tabular-nums">{row.wins}</TableCell>
              <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
              <TableCell className="text-right tabular-nums">{row.winPct}%</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Ще немає жодного гравця.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
