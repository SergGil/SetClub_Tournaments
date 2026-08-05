import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildHeadToHeadMatrix, headToHeadCell } from "@/lib/head-to-head";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/permissions";
import { getPlayerByUserId, getPlayers } from "@/lib/queries/players";
import { getAllPlayerStats, getHeadToHeadMatchRows, getMonthlyActivity, getResultYears } from "@/lib/stats";
import type { MonthlyCount } from "@/lib/activity-trend";

const HEAD_TO_HEAD_SIZE = 8;
const CHART_BAR_MAX_PX = 96;

function firstName(name: string) {
  return name.split(" ")[0];
}

/** Single-series monthly bar chart, hand-rolled in HTML/CSS (no chart library) - a zero month gets a thin visible sliver rather than an invisible bar, and every count is a direct label, never color-only. */
function MonthlyBarChart({ title, data }: { title: string; data: MonthlyCount[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="flex items-end gap-2" style={{ height: CHART_BAR_MAX_PX + 24 }}>
        {data.map((d) => (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5" title={`${d.label}: ${d.count}`}>
            <span className="text-xs font-medium tabular-nums">{d.count}</span>
            <div
              className="w-full rounded-t-md bg-primary"
              style={{ height: d.count === 0 ? 2 : Math.max(4, (d.count / max) * CHART_BAR_MAX_PX) }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {data.map((d) => (
          <span key={d.key} className="flex-1 text-center text-[0.65rem] whitespace-nowrap text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export const metadata = { title: "Статистика" };

const TYPE_FILTERS = [
  { value: undefined, label: "Усі матчі" },
  { value: "SINGLES", label: "Одиночні (1×1)" },
  { value: "DOUBLES", label: "Парні (2×2)" },
] as const;

const GENDER_FILTERS = [
  { value: undefined, label: "Усі" },
  { value: "MALE", label: "Чоловіки" },
  { value: "FEMALE", label: "Жінки" },
] as const;

const RANK_STYLE = [
  "bg-amber-500/15 text-amber-600 dark:text-amber-400", // 1st
  "bg-zinc-400/15 text-zinc-500 dark:text-zinc-400", // 2nd
  "bg-orange-700/15 text-orange-700 dark:text-orange-500", // 3rd
];

function exactWinRatio(row: { wins: number; matchesPlayed: number }) {
  return row.matchesPlayed > 0 ? row.wins / row.matchesPlayed : 0;
}

function buildHref(type: string | undefined, year: number | undefined, gender: string | undefined) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (year) params.set("year", String(year));
  if (gender) params.set("gender", gender);
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; year?: string; gender?: string }>;
}) {
  const { type, year, gender } = await searchParams;
  const activeType = type === "SINGLES" || type === "DOUBLES" ? type : undefined;
  const activeGender = gender === "MALE" || gender === "FEMALE" ? gender : undefined;

  const [allPlayers, resultYears, session, monthlyActivity] = await Promise.all([
    getPlayers(),
    getResultYears(),
    getSession(),
    getMonthlyActivity(),
  ]);
  const players = activeGender ? allPlayers.filter((p) => p.gender === activeGender) : allPlayers;
  const parsedYear = year ? Number(year) : undefined;
  const activeYear = parsedYear && resultYears.includes(parsedYear) ? parsedYear : undefined;
  const [stats, headToHeadRows] = await Promise.all([
    getAllPlayerStats(activeType, activeYear),
    getHeadToHeadMatchRows(activeType, activeYear),
  ]);
  const viewerPlayer = session?.user ? await getPlayerByUserId(session.user.id) : null;
  const hasFilter = Boolean(activeType) || Boolean(activeYear) || Boolean(activeGender);

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
        tournamentsPlayed: s?.tournamentsPlayed ?? 0,
      };
    })
    .filter((row) => row.matchesPlayed > 0 || !hasFilter)
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        // Compare the exact ratio, not the rounded winPct - otherwise players
        // with different match counts can round to the same percentage
        // (2/15 = 13.3% and 2/16 = 12.5% both round to 13%) and get wrongly
        // treated as tied.
        exactWinRatio(b) - exactWinRatio(a) ||
        b.gamesWon - b.gamesLost - (a.gamesWon - a.gamesLost) ||
        a.name.localeCompare(b.name),
    );

  const topPlayers = rows.filter((row) => row.matchesPlayed > 0).slice(0, HEAD_TO_HEAD_SIZE);
  const headToHeadMatrix = buildHeadToHeadMatrix(
    headToHeadRows,
    topPlayers.map((p) => p.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Загальна статистика</h1>
        <p className="text-sm text-foreground/80">
          {activeYear ? `Результати за ${activeYear} рік.` : "Результати за всю історію клубу."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
          {TYPE_FILTERS.map((filter) => {
            const isActive = filter.value === activeType;
            return (
              <Link
                key={filter.label}
                href={buildHref(filter.value, activeYear, activeGender)}
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

        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
          {GENDER_FILTERS.map((filter) => {
            const isActive = filter.value === activeGender;
            return (
              <Link
                key={filter.label}
                href={buildHref(activeType, activeYear, filter.value)}
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

        {resultYears.length > 0 && (
          <div className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
            <Link
              href={buildHref(activeType, undefined, activeGender)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                !activeYear
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Усі роки
            </Link>
            {resultYears.map((y) => (
              <Link
                key={y}
                href={buildHref(activeType, y, activeGender)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium tabular-nums transition-colors",
                  activeYear === y
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {y}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="sticky left-0 z-10 bg-card">Гравець</TableHead>
              <TableHead className="text-right">Турнірів</TableHead>
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
                className={cn("group", row.id === viewerPlayer?.id && "bg-accent/50")}
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
                <TableCell
                  className={cn(
                    "sticky left-0 z-10 font-medium whitespace-nowrap group-hover:bg-muted/50",
                    row.id === viewerPlayer?.id ? "bg-accent/50" : "bg-card",
                  )}
                >
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
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.tournamentsPlayed}
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
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  {hasFilter ? "Немає гравців з такими матчами." : "Ще немає жодного гравця."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {topPlayers.length >= 2 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Хто кого обігравав</h2>
            <p className="text-sm text-foreground/80">
              Особисті зустрічі топ-{topPlayers.length} за перемогами
              {activeYear ? ` у ${activeYear} році` : ""}. У клітинці — рахунок гравця в рядку проти
              гравця в стовпці.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card p-2 text-left" />
                  {topPlayers.map((colPlayer) => (
                    <th
                      key={colPlayer.id}
                      className="p-2 text-center font-medium whitespace-nowrap text-muted-foreground"
                      title={colPlayer.name}
                    >
                      <Link href={`/players/${colPlayer.id}`} className="hover:underline">
                        {firstName(colPlayer.name)}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topPlayers.map((rowPlayer) => (
                  <tr key={rowPlayer.id}>
                    <td className="sticky left-0 z-10 bg-card p-2 font-medium whitespace-nowrap">
                      <Link href={`/players/${rowPlayer.id}`} className="hover:underline">
                        {rowPlayer.name}
                      </Link>
                    </td>
                    {topPlayers.map((colPlayer) => {
                      if (colPlayer.id === rowPlayer.id) {
                        return (
                          <td key={colPlayer.id} className="p-2 text-center text-muted-foreground">
                            —
                          </td>
                        );
                      }
                      const cell = headToHeadCell(headToHeadMatrix, rowPlayer.id, colPlayer.id);
                      if (!cell) {
                        return (
                          <td key={colPlayer.id} className="p-2 text-center text-muted-foreground/50">
                            –
                          </td>
                        );
                      }
                      const winRate = cell.wins / (cell.wins + cell.losses);
                      const intensity = Math.abs(winRate - 0.5) * 2;
                      const tintPct = Math.round(10 + intensity * 25);
                      const tintColor = winRate > 0.5 ? "var(--primary)" : "var(--destructive)";
                      return (
                        <td
                          key={colPlayer.id}
                          className="p-2 text-center tabular-nums"
                          style={
                            winRate !== 0.5
                              ? { backgroundColor: `color-mix(in oklch, ${tintColor} ${tintPct}%, transparent)` }
                              : undefined
                          }
                        >
                          {cell.wins}–{cell.losses}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
              частіше вигравав
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full" style={{ backgroundColor: "var(--destructive)" }} />
              частіше програвав
            </span>
          </p>
        </div>
      )}

      {(monthlyActivity.matches.length > 0 || monthlyActivity.tournaments.length > 0) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Активність клубу</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MonthlyBarChart title="Матчів по місяцях" data={monthlyActivity.matches} />
            <MonthlyBarChart title="Турнірів по місяцях" data={monthlyActivity.tournaments} />
          </div>
        </div>
      )}
    </div>
  );
}
