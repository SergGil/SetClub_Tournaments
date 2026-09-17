import Link from "next/link";

import { PillFilterGroup, PillFilterLink } from "@/components/pill-filter";
import { PlayerCompareForm } from "@/components/player-compare-form";
import { RatingCompareChart } from "@/components/rating-compare-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { buildHeadToHeadMatrix, headToHeadCell } from "@/lib/head-to-head";
import { displayName } from "@/lib/player-display";
import { getPlayers } from "@/lib/queries/players";
import type { DoublesRatingRow, SinglesRatingRow } from "@/lib/rating/engine";
import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";
import { getDoublesRatings, getPlayerRatingHistory, getSinglesRatings } from "@/lib/rating/ratings-data";
import { getAllPlayerStats, getHeadToHeadMatchRows } from "@/lib/stats";
import { cn } from "@/lib/utils";

type RatingCard = { rating: number; spread: number; matchesPlayed: number };

function singlesRatingCard(row: SinglesRatingRow): RatingCard {
  return {
    rating: Math.round(conservativeRating(row.rating)),
    spread: Math.round(row.rating.rd),
    matchesPlayed: row.matchesPlayed,
  };
}

function doublesRatingCard(row: DoublesRatingRow): RatingCard {
  return {
    rating: Math.round(conservativeOrdinal(row.rating)),
    spread: Math.round(displaySpread(row.rating.sigma)),
    matchesPlayed: row.matchesPlayed,
  };
}

export const metadata = { title: "Порівняння гравців" };

const FORMAT_FILTERS = [
  { value: "singles", label: "Одиночні" },
  { value: "doubles", label: "Парні" },
] as const;

function buildHref(a: string, b: string, format: string) {
  const params = new URLSearchParams();
  if (a) params.set("a", a);
  if (b) params.set("b", b);
  if (format !== "singles") params.set("format", format);
  const qs = params.toString();
  return qs ? `/rating/compare?${qs}` : "/rating/compare";
}

export default async function ComparePlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; format?: string }>;
}) {
  const { a: aParam, b: bParam, format } = await searchParams;
  const activeFormat = format === "doubles" ? "doubles" : "singles";
  const matchType = activeFormat === "doubles" ? "DOUBLES" : "SINGLES";

  const players = await getPlayers();
  const nameById = new Map(
    players.map((p) => [p.id, { name: displayName(p), image: p.user?.image ?? null }]),
  );
  const playerOptions = players
    .map((p) => ({ id: p.id, name: displayName(p) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const idA = aParam && nameById.has(aParam) ? aParam : "";
  const idB = bParam && nameById.has(bParam) && bParam !== idA ? bParam : "";
  const ready = Boolean(idA && idB);

  const comparison = ready
    ? await (async () => {
        const [statsMap, historyA, historyB, h2hRows] = await Promise.all([
          getAllPlayerStats(matchType),
          getPlayerRatingHistory(idA, matchType),
          getPlayerRatingHistory(idB, matchType),
          getHeadToHeadMatchRows(matchType),
        ]);

        // Kept as two branches (rather than one generic `getRatings()` call)
        // so TS keeps each branch's row type concrete - collapsing them into
        // a `SinglesRatingRow | DoublesRatingRow` union loses the connection
        // between which `.rating` shape (Glicko2Rating vs OpenSkillRating)
        // and which conservative-rating function go together.
        let ratingA: RatingCard | null;
        let ratingB: RatingCard | null;
        if (activeFormat === "doubles") {
          const rows = await getDoublesRatings();
          const rowA = rows.find((r) => r.playerId === idA);
          const rowB = rows.find((r) => r.playerId === idB);
          ratingA = rowA ? doublesRatingCard(rowA) : null;
          ratingB = rowB ? doublesRatingCard(rowB) : null;
        } else {
          const rows = await getSinglesRatings();
          const rowA = rows.find((r) => r.playerId === idA);
          const rowB = rows.find((r) => r.playerId === idB);
          ratingA = rowA ? singlesRatingCard(rowA) : null;
          ratingB = rowB ? singlesRatingCard(rowB) : null;
        }

        const matrix = buildHeadToHeadMatrix(h2hRows, [idA, idB]);
        const cell = headToHeadCell(matrix, idA, idB);

        return {
          ratingA,
          ratingB,
          statsA: statsMap.get(idA) ?? null,
          statsB: statsMap.get(idB) ?? null,
          historyA,
          historyB,
          h2h: cell ? { winsA: cell.wins, winsB: cell.losses } : null,
        };
      })()
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Порівняння гравців
        </h1>
        <p className="text-sm text-foreground/80">Рейтинг у часі й особисті зустрічі двох гравців поруч.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PillFilterGroup>
          {FORMAT_FILTERS.map((filter) => (
            <PillFilterLink
              key={filter.value}
              href={buildHref(idA, idB, filter.value)}
              active={filter.value === activeFormat}
            >
              {filter.label}
            </PillFilterLink>
          ))}
        </PillFilterGroup>
        <PlayerCompareForm players={playerOptions} selectedA={idA} selectedB={idB} format={activeFormat} />
      </div>

      {!ready && <p className="text-foreground/80">Оберіть двох гравців вище, щоб порівняти їхній рейтинг.</p>}

      {ready && comparison && (!comparison.ratingA || !comparison.ratingB) && (
        <p className="text-foreground/80">
          У {activeFormat === "singles" ? "одиночному" : "парному"} форматі один із гравців ще не зіграв
          жодного матчу.
        </p>
      )}

      {ready && comparison && comparison.ratingA && comparison.ratingB && (
        <Card>
          <CardContent className="flex flex-col gap-5 p-4 sm:p-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <PlayerHead
                id={idA}
                name={nameById.get(idA)!.name}
                image={nameById.get(idA)!.image}
                rating={comparison.ratingA}
                align="left"
              />
              <span
                className="text-lg font-extrabold text-muted-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                VS
              </span>
              <PlayerHead
                id={idB}
                name={nameById.get(idB)!.name}
                image={nameById.get(idB)!.image}
                rating={comparison.ratingB}
                align="right"
              />
            </div>

            <RatingCompareChart seriesA={comparison.historyA} seriesB={comparison.historyB} />
            <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                {nameById.get(idA)!.name}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: "var(--home-accent)" }} />
                {nameById.get(idB)!.name}
              </span>
            </div>

            <div className="flex flex-col">
              <CompareRow
                label="Рейтинг"
                valueA={`${comparison.ratingA.rating} ±${comparison.ratingA.spread}`}
                valueB={`${comparison.ratingB.rating} ±${comparison.ratingB.spread}`}
                better={
                  comparison.ratingA.rating === comparison.ratingB.rating
                    ? null
                    : comparison.ratingA.rating > comparison.ratingB.rating
                      ? "a"
                      : "b"
                }
              />
              <CompareRow
                label="Матчів"
                valueA={comparison.ratingA.matchesPlayed}
                valueB={comparison.ratingB.matchesPlayed}
              />
              {comparison.statsA && comparison.statsB && (
                <CompareRow
                  label="Win rate"
                  valueA={`${comparison.statsA.winPct}%`}
                  valueB={`${comparison.statsB.winPct}%`}
                  better={
                    comparison.statsA.winPct === comparison.statsB.winPct
                      ? null
                      : comparison.statsA.winPct > comparison.statsB.winPct
                        ? "a"
                        : "b"
                  }
                />
              )}
              {comparison.h2h ? (
                <CompareRow
                  label="Особисті зустрічі"
                  valueA={comparison.h2h.winsA}
                  valueB={comparison.h2h.winsB}
                  better={
                    comparison.h2h.winsA === comparison.h2h.winsB
                      ? null
                      : comparison.h2h.winsA > comparison.h2h.winsB
                        ? "a"
                        : "b"
                  }
                />
              ) : (
                <p className="border-t py-3 text-center text-sm text-muted-foreground">
                  Ще не грали одне проти одного.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlayerHead({
  id,
  name,
  image,
  rating,
  align,
}: {
  id: string;
  name: string;
  image: string | null;
  rating: { rating: number; spread: number };
  align: "left" | "right";
}) {
  return (
    <Link
      href={`/players/${id}`}
      className={cn(
        // min-w-0: this Link is itself a grid item (grid-cols-[1fr_auto_1fr]
        // in the parent) - without it, a flex/grid item's default
        // min-width:auto keeps it from shrinking below its content's natural
        // width, so the long name overflowed the card on narrow screens
        // instead of the child's own `truncate` ever kicking in.
        "flex min-w-0 items-center gap-2.5 hover:opacity-90",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={image ?? undefined} alt={name} />
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {rating.rating} <span className="text-[0.7rem]">±{rating.spread}</span>
        </p>
      </div>
    </Link>
  );
}

function CompareRow({
  label,
  valueA,
  valueB,
  better,
}: {
  label: string;
  valueA: string | number;
  valueB: string | number;
  better?: "a" | "b" | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
      <span className={cn("tabular-nums", better === "a" ? "font-bold text-primary" : "text-foreground")}>
        {valueA}
      </span>
      <span className="text-center text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className={cn("text-right tabular-nums", better === "b" ? "font-bold text-primary" : "text-foreground")}>
        {valueB}
      </span>
    </div>
  );
}
