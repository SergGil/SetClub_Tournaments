import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/permissions";
import { getPlayerByUserId, getPlayers } from "@/lib/queries/players";
import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";
import { getDoublesRatings, getSinglesRatings } from "@/lib/rating/ratings-data";
import { cn } from "@/lib/utils";

export const metadata = { title: "Рейтинг" };

const FORMAT_FILTERS = [
  { value: "singles", label: "Одиночні", badge: "accent" as const },
  { value: "doubles", label: "Парні", badge: "teal" as const },
];

const RANK_STYLE = [
  "bg-amber-500/15 text-amber-600 dark:text-amber-400", // 1st
  "bg-zinc-400/15 text-zinc-500 dark:text-zinc-400", // 2nd
  "bg-orange-700/15 text-orange-700 dark:text-orange-500", // 3rd
];

const INFORMER_SECTIONS = [
  {
    title: "Що таке рейтинг",
    body: "Рейтинг — це число, яке показує приблизну силу гравця на основі результатів усіх його матчів, а не лише кількості перемог. Перемога над сильним суперником піднімає рейтинг більше, ніж перемога над слабшим; поразка від сильного суперника опускає його менше, ніж поразка від слабшого.",
  },
  {
    title: "Чому одиночний і парний рейтинги не можна порівнювати",
    body: "Одиночний і парний рейтинг рахуються двома різними математичними методами і показані в схожому діапазоні чисел лише для зручності — це не означає, що вони порівнянні. Порівнювати можна тільки одиночний рейтинг з одиночним, і парний з парним.",
  },
  {
    title: "Як враховується рахунок геймів",
    body: "Перемога 6:0, 6:0 піднімає рейтинг сильніше, ніж перемога 7:6 у вирішальному сеті — система враховує не лише сам факт перемоги, а й те, наскільки впевненою вона була.",
  },
  {
    title: "Чому в парі партнери можуть отримувати різну зміну рейтингу",
    body: "У парних матчах неможливо напряму визначити, хто з двох партнерів заслуговує більше 'заслуги' за перемогу — тож зміна ділиться між ними залежно від того, наскільки система ще не впевнена в кожному: новачок у парі 'рухається' сильніше за результатом матчу, ніж досвідчений партнер поруч.",
  },
  {
    title: "Чому в нових або тих, хто рідко грає, рейтинг менш стабільний",
    body: "Поруч із рейтингом стоїть позначка '±...' — вона показує, наскільки система ще не впевнена в реальному рівні гравця. Що більше матчів гравець зіграв нещодавно, то менше коливається його рейтинг від одного результату.",
  },
  {
    title: "Чому парний рейтинг не змінюється від перерви так, як одиночний",
    body: "Одиночний рейтинг поступово стає менш точним (позначка '±' зростає), якщо гравець довго не грає турніри. Парний рейтинг цього не робить — він змінюється лише тоді, коли гравець фактично зіграв матч.",
  },
];

function buildHref(format: string) {
  return format === "singles" ? "?" : `?format=${format}`;
}

export default async function RatingPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string }>;
}) {
  const { format } = await searchParams;
  const activeFormat = format === "doubles" ? "doubles" : "singles";

  const [players, singlesRatings, doublesRatings, session] = await Promise.all([
    getPlayers(),
    getSinglesRatings(),
    getDoublesRatings(),
    getSession(),
  ]);
  const viewerPlayer = session?.user ? await getPlayerByUserId(session.user.id) : null;
  const nameById = new Map(players.map((p) => [p.id, { name: p.name, image: p.user?.image ?? null }]));

  const rows =
    activeFormat === "singles"
      ? singlesRatings.map((row) => ({
          playerId: row.playerId,
          rating: Math.round(conservativeRating(row.rating)),
          spread: Math.round(row.rating.rd),
          matchesPlayed: row.matchesPlayed,
        }))
      : doublesRatings.map((row) => ({
          playerId: row.playerId,
          rating: Math.round(conservativeOrdinal(row.rating)),
          spread: Math.round(displaySpread(row.rating.sigma)),
          matchesPlayed: row.matchesPlayed,
        }));

  const activeFilter = FORMAT_FILTERS.find((f) => f.value === activeFormat)!;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Рейтинг</h1>
        <p className="text-sm text-foreground/80">
          Індивідуальний рейтинг гравців клубу з урахуванням сили суперників і рахунку геймів.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
          {FORMAT_FILTERS.map((filter) => {
            const isActive = filter.value === activeFormat;
            return (
              <Link
                key={filter.value}
                href={buildHref(filter.value)}
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
        <Badge variant={activeFilter.badge}>
          {activeFormat === "singles" ? "Glicko-2" : "OpenSkill"}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Гравець</TableHead>
              <TableHead className="text-right">Рейтинг</TableHead>
              <TableHead className="text-right">Матчів</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const player = nameById.get(row.playerId);
              if (!player) return null;
              return (
                <TableRow
                  key={row.playerId}
                  className={row.playerId === viewerPlayer?.id ? "bg-accent/50" : undefined}
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
                    <Link
                      href={`/players/${row.playerId}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Avatar className="size-6">
                        <AvatarImage src={player.image ?? undefined} alt={player.name} />
                        <AvatarFallback className="text-[10px]">
                          {player.name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {player.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.rating}
                    <span className="ml-1 text-xs text-muted-foreground">±{row.spread}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.matchesPlayed}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Ще немає завершених матчів цього формату.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Як рахується рейтинг</p>
        {INFORMER_SECTIONS.map((section) => (
          <details key={section.title} className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">{section.title}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{section.body}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
