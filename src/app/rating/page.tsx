import Link from "next/link";

import { PillFilterGroup, PillFilterLink } from "@/components/pill-filter";
import { RatingDistributionChart } from "@/components/rating-distribution-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import { getSession } from "@/lib/permissions";
import { displayName } from "@/lib/player-display";
import { getPlayerByUserId, getPlayers } from "@/lib/queries/players";
import { RANK_STYLE } from "@/lib/rank-style";
import type { DistributionPoint } from "@/lib/rating-distribution";
import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";
import {
  getDoublesRatings,
  getDoublesSetClubPoints,
  getSetClubSeasons,
  getSinglesRatings,
  getSinglesSetClubPoints,
  ROLLING_SEASON,
} from "@/lib/rating/ratings-data";
import type { SetClubSeason } from "@/lib/rating/ratings-data";
import { cn } from "@/lib/utils";

export const metadata = { title: "Рейтинг" };

const FORMAT_FILTERS = [
  { value: "singles", label: "Одиночні" },
  { value: "doubles", label: "Парні" },
] as const;

/** "official" is Glicko-2 (singles) / OpenSkill (doubles); "setclub" is the club's own placement-points ladder (see src/lib/rating/setclub.ts and setclub-singles.ts) - the two are alternate calculation models for the same format, not separate pages. */
const MODEL_FILTERS = [
  { value: "setclub", singlesLabel: "SET.club", doublesLabel: "SET.club" },
  { value: "official", singlesLabel: "Glicko-2", doublesLabel: "OpenSkill" },
] as const;

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
    body: "Перемога в двох сетах з рахунком 6:0 кожен піднімає рейтинг сильніше, ніж перемога 7:6 у вирішальному сеті — система враховує не лише сам факт перемоги, а й те, наскільки впевненою вона була.",
  },
  {
    title: "Чому в нових або тих, хто рідко грає, рейтинг менш стабільний",
    body: "Поруч із рейтингом стоїть позначка '±...' — вона показує, наскільки система ще не впевнена в реальному рівні гравця. Що більше матчів гравець зіграв нещодавно, то менше коливається його рейтинг від одного результату.",
  },
  {
    title: "Як зміна рейтингу ділиться між партнерами в парі",
    body: "У парному матчі неможливо напряму визначити, хто з двох партнерів заслуговує більше 'заслуги' за перемогу — тож зміна рейтингу ділиться між ними. Якщо адмін заздалегідь позначив одного з партнерів сіяним (незалежно від того, склав пару рандомайзер чи адмін вручну), сіяний отримує ~60% зміни за результат матчу, несіяний — ~40%, і в плюс за перемогу, і в мінус за поразку. Якщо в парі обидва сіяні або обидва несіяні — такого сигналу немає, і зміна ділиться за тим, наскільки система ще не впевнена в кожному з двох гравців (та сама позначка '±' — новачок у парі 'рухається' сильніше за результатом матчу, ніж досвідчений партнер поруч).",
  },
  {
    title: "Чому парний рейтинг не змінюється від перерви так, як одиночний",
    body: "Одиночний рейтинг поступово стає менш точним (позначка '±' зростає), якщо гравець довго не грає турніри. Парний рейтинг цього не робить — він змінюється лише тоді, коли гравець фактично зіграв матч.",
  },
  {
    title: "Чому мене немає в таблиці",
    body: "Рейтинг рахується лише за завершеними матчами обраного формату — гравець, який ще не зіграв жодного завершеного одиночного (чи парного) матчу, просто ще не з'являється в цій таблиці. Він з'явиться одразу після першого завершеного матчу цього формату.",
  },
];

function setClubInformerSections(format: "singles" | "doubles") {
  const placeFormula = {
    title: "Як нараховуються бали за місце",
    body:
      format === "doubles"
        ? "Якщо в турнірі грає N пар, пара, що посіла місце k, отримує 2 × (N − k + 1) балів. Наприклад, у турнірі з 6 пар переможець отримує 12 балів, друге місце — 10, третє — 8, і так далі до 2 балів за останнє місце. Що більший турнір, то більше балів дає перемога в ньому."
        : "Якщо в турнірі зареєстровано N учасників, гравець, що посів місце k, отримує 2 × (N − k + 1) балів. Наприклад, у турнірі на 12 учасників переможець отримує 24 бали, друге місце — 22, третє — 20, і так далі до 2 балів за останнє місце. Що більший турнір, то більше балів дає перемога в ньому.",
  };
  const sections = [
    {
      title: "Що таке SET.club",
      body: "SET.club — альтернативний спосіб рахувати рейтинг, простіший за Glicko-2/OpenSkill: замість оцінки \"справжньої сили\" гравця він просто нараховує бали за місце, яке гравець (чи пара) посів у турнірі. Це радше турнірна таблиця клубу за сезон, ніж статистична оцінка рівня гри.",
    },
    placeFormula,
  ];
  if (format === "doubles") {
    sections.push({
      title: "Чому сіяний партнер отримує більше балів",
      body: "Бали пари діляться між партнерами нарівно, окрім одного випадку: якщо в парі один гравець сіяний, а інший — ні, сіяний (той, кого адмін вважає сильнішим) отримує бали пари повністю, несіяний — половину. Якщо в парі обидва сіяні або обидва несіяні — сигналу, хто сильніший, немає, і бали отримують обидва партнери повністю.",
    });
  }
  sections.push(
    {
      title: "Як визначається місце в турнірі",
      body: `Насамперед за результатами плей-офф (Фінал, матчі за 3/5/7/9/11 місце), якщо він є — переможець Фіналу завжди займає 1 місце, і так далі. Ті, чиє місце плей-офф не визначив (наприклад, турнір узагалі без плей-офф, або хтось вибув без матчу за конкретне місце), ранжуються за таблицею групового етапу${format === "singles" ? " (для формату «4 групи по 3 + плейофф» місця 9-12 визначаються за окремою міні-групою, а не всім турніром)" : ""}.`,
    },
    {
      title: "Що означає «Загальний»",
      body: "За замовчуванням таблиця показує бали за останні 52 тижні — так само, як офіційний рейтинг ATP: бали за кожен турнір діють рівно 52 тижні від дати цього турніру, а тоді автоматично «згорають» самі, без різкого обнулення 1 січня. Перемикач поруч додатково дозволяє подивитись бали за окремий календарний рік.",
    },
  );
  return sections;
}

function buildHref(next: { format: string; model: string }) {
  const params = new URLSearchParams();
  if (next.format !== "singles") params.set("format", next.format);
  // "setclub" is the default model (see activeModel below) - omitted from
  // the URL so the default view keeps a clean "?" / no query string.
  if (next.model !== "setclub") params.set("model", next.model);
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

/** Switching periods keeps the current format/model but always sets an explicit season - ROLLING_SEASON ("rolling") or a specific calendar year, see docs/RATING.md. */
function buildSeasonHref(format: string, model: string, season: SetClubSeason): string {
  const params = new URLSearchParams();
  if (format !== "singles") params.set("format", format);
  if (model !== "setclub") params.set("model", model);
  params.set("season", String(season));
  return `?${params.toString()}`;
}

export default async function RatingPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; model?: string; season?: string }>;
}) {
  const { format, model, season } = await searchParams;
  const activeFormat = format === "doubles" ? "doubles" : "singles";
  // Set Club is the default landing view (see buildHref) - the official
  // Glicko-2/OpenSkill model only shows when explicitly requested.
  const activeModel = model === "official" ? "official" : "setclub";
  const showSetClubDoubles = activeFormat === "doubles" && activeModel === "setclub";
  const showSetClubSingles = activeFormat === "singles" && activeModel === "setclub";

  const [players, singlesRatings, doublesRatings, session, setClubSeasons] = await Promise.all([
    getPlayers(),
    getSinglesRatings(),
    getDoublesRatings(),
    getSession(),
    getSetClubSeasons(activeFormat === "doubles" ? "DOUBLES" : "SINGLES"),
  ]);
  const viewerPlayer = session?.user ? await getPlayerByUserId(session.user.id) : null;
  const nameById = new Map(
    players.map((p) => [p.id, { name: displayName(p), image: p.user?.image ?? null }]),
  );

  const parsedSeason = season && season !== ROLLING_SEASON ? Number(season) : undefined;
  // Defaults to the rolling 52-week window (ROLLING_SEASON) - a specific
  // calendar year only wins when explicitly requested and it's one that
  // actually has data (see getSetClubSeasons).
  const activeSeason: SetClubSeason =
    season === ROLLING_SEASON
      ? ROLLING_SEASON
      : parsedSeason && setClubSeasons.includes(parsedSeason)
        ? parsedSeason
        : ROLLING_SEASON;
  const setClubPoints = showSetClubDoubles
    ? await getDoublesSetClubPoints(activeSeason)
    : showSetClubSingles
      ? await getSinglesSetClubPoints(activeSeason)
      : [];

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

  // Surfaces the "чому мене немає в таблиці" informer pre-opened, but only
  // for a logged-in player who actually isn't in the current table - opening
  // it for everyone would bury the answer under noise for viewers it doesn't
  // apply to, and leaving it always collapsed buries it under the table for
  // exactly the person asking "де я?".
  const viewerMissingFromTable =
    Boolean(viewerPlayer) && !rows.some((row) => row.playerId === viewerPlayer!.id);

  const distributionPoints: DistributionPoint[] = rows
    .map((row) => {
      const player = nameById.get(row.playerId);
      return player ? { playerId: row.playerId, name: player.name, value: row.rating } : null;
    })
    .filter((p): p is DistributionPoint => p !== null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Рейтинг</h1>
        <p className="text-sm text-foreground/80">
          Індивідуальний рейтинг гравців клубу з урахуванням сили суперників і рахунку геймів.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PillFilterGroup>
          {FORMAT_FILTERS.map((filter) => (
            <PillFilterLink
              key={filter.value}
              href={buildHref({ format: filter.value, model: activeModel })}
              active={filter.value === activeFormat}
            >
              {filter.label}
            </PillFilterLink>
          ))}
        </PillFilterGroup>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Метод:</span>
          <PillFilterGroup>
            {MODEL_FILTERS.map((filter) => (
              <PillFilterLink
                key={filter.value}
                href={buildHref({ format: activeFormat, model: filter.value })}
                active={filter.value === activeModel}
              >
                {activeFormat === "singles" ? filter.singlesLabel : filter.doublesLabel}
              </PillFilterLink>
            ))}
          </PillFilterGroup>
        </div>
      </div>

      {(showSetClubDoubles || showSetClubSingles) && (
        <PillFilterGroup>
          <PillFilterLink
            href={buildSeasonHref(activeFormat, activeModel, ROLLING_SEASON)}
            active={activeSeason === ROLLING_SEASON}
          >
            Загальний
          </PillFilterLink>
          {setClubSeasons.map((y) => (
            <PillFilterLink
              key={y}
              href={buildSeasonHref(activeFormat, activeModel, y)}
              active={activeSeason === y}
              className="tabular-nums"
            >
              {y}
            </PillFilterLink>
          ))}
        </PillFilterGroup>
      )}

      {showSetClubDoubles || showSetClubSingles ? (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="sticky left-0 z-10 bg-card">Гравець</TableHead>
                  <TableHead className="text-right">Бали</TableHead>
                  <TableHead className="text-right">Турнірів</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {setClubPoints.map((row, index) => {
                  const player = nameById.get(row.playerId);
                  if (!player) return null;
                  return (
                    <TableRow
                      key={row.playerId}
                      className={cn("group", row.playerId === viewerPlayer?.id && "bg-accent/50")}
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
                      <TableRowHeader
                        className={cn(
                          "sticky left-0 z-10 font-medium whitespace-nowrap group-hover:bg-muted/50",
                          row.playerId === viewerPlayer?.id
                            ? "bg-[color-mix(in_oklch,var(--accent)_50%,var(--card))]"
                            : "bg-card",
                        )}
                      >
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
                      </TableRowHeader>
                      <TableCell className="text-right tabular-nums">{row.points}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.tournamentsPlayed}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {setClubPoints.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      {showSetClubDoubles
                        ? "Ще немає завершених парних турнірів у цьому сезоні."
                        : "Ще немає завершених одиночних турнірів у цьому сезоні."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Як рахуються бали SET.club</p>
            {setClubInformerSections(activeFormat).map((section) => (
              <details key={section.title} className="rounded-lg border bg-card p-4">
                <summary className="cursor-pointer font-medium">{section.title}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{section.body}</p>
              </details>
            ))}
          </div>
        </>
      ) : (
        <>
          <RatingDistributionChart
            title={`Розподіл рейтингу — ${activeFormat === "singles" ? "одиночний" : "парний"}`}
            points={distributionPoints}
          />

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="sticky left-0 z-10 bg-card">Гравець</TableHead>
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
                      className={cn("group", row.playerId === viewerPlayer?.id && "bg-accent/50")}
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
                      <TableRowHeader
                        className={cn(
                          "sticky left-0 z-10 font-medium whitespace-nowrap group-hover:bg-muted/50",
                          row.playerId === viewerPlayer?.id
                            ? "bg-[color-mix(in_oklch,var(--accent)_50%,var(--card))]"
                            : "bg-card",
                        )}
                      >
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
                      </TableRowHeader>
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
              <details
                key={section.title}
                open={
                  section.title === "Чому мене немає в таблиці" && viewerMissingFromTable
                    ? true
                    : undefined
                }
                className="rounded-lg border bg-card p-4"
              >
                <summary className="cursor-pointer font-medium">{section.title}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{section.body}</p>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
