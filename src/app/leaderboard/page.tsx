import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/permissions";
import { getPlayerByUserId, getPlayers } from "@/lib/queries/players";
import { getAllPlayerStats } from "@/lib/stats";

export const metadata = { title: "Рейтинг" };

const FILTERS = [
  { value: undefined, label: "Усі матчі" },
  { value: "SINGLES", label: "Одиночні (1×1)" },
  { value: "DOUBLES", label: "Парні (2×2)" },
] as const;

const RANK_STYLE = [
  "bg-amber-500/15 text-amber-600 dark:text-amber-400", // 1st
  "bg-zinc-400/15 text-zinc-500 dark:text-zinc-400", // 2nd
  "bg-orange-700/15 text-orange-700 dark:text-orange-500", // 3rd
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const activeType = type === "SINGLES" || type === "DOUBLES" ? type : undefined;

  const [players, stats, session] = await Promise.all([
    getPlayers(),
    getAllPlayerStats(activeType),
    getSession(),
  ]);
  const viewerPlayer = session?.user ? await getPlayerByUserId(session.user.id) : null;

  const rows = players
    .map((player) => {
      const s = stats.get(player.id);
      return {
        id: player.id,
        name: player.name,
        image: player.user?.image ?? null,
        matchesPlayed: s?.matchesPlayed ?? 0,
        wins: s?.wins ?? 0,
        losses: s?.losses ?? 0,
        winPct: s?.winPct ?? 0,
        gamesWon: s?.gamesWon ?? 0,
        gamesLost: s?.gamesLost ?? 0,
      };
    })
    .filter((row) => row.matchesPlayed > 0 || !activeType)
    .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Загальний рейтинг</h1>
        <p className="text-sm text-muted-foreground">Результати за всю історію клубу.</p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
        {FILTERS.map((filter) => {
          const isActive = filter.value === activeType;
          return (
            <Link
              key={filter.label}
              href={filter.value ? `?type=${filter.value}` : "?"}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Гравець</TableHead>
              <TableHead className="text-right">Матчів</TableHead>
              <TableHead className="text-right">Перемог</TableHead>
              <TableHead className="text-right">Поразок</TableHead>
              <TableHead className="text-right">Геймів</TableHead>
              <TableHead className="w-40">% перемог</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.id}
                className={row.id === viewerPlayer?.id ? "bg-accent/50" : undefined}
              >
                <TableCell>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      RANK_STYLE[index] ?? "text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/players/${row.id}`} className="flex items-center gap-2 hover:underline">
                    <Avatar className="size-6">
                      <AvatarImage src={row.image ?? undefined} alt={row.name} />
                      <AvatarFallback className="text-[10px]">
                        {row.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.matchesPlayed}</TableCell>
                <TableCell className="text-right tabular-nums">{row.wins}</TableCell>
                <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.gamesWon}:{row.gamesLost}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${row.winPct}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {row.winPct}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {activeType ? "Немає гравців з такими матчами." : "Ще немає жодного гравця."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
