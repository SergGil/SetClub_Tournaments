import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateUTC } from "@/lib/date-format";
import type { TournamentListItem, TournamentSort, TournamentSortKey } from "@/lib/queries/tournaments";
import {
  COURT_SURFACE_LABEL,
  COURT_SURFACE_VARIANT,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_VARIANT,
} from "@/lib/validation/tournament";

function buildSortHref(baseHref: string, key: TournamentSortKey, sort: TournamentSort): string {
  const nextDir = sort.key === key && sort.dir === "desc" ? "asc" : "desc";
  const url = new URL(baseHref, "http://placeholder");
  url.searchParams.set("sort", key);
  url.searchParams.set("dir", nextDir);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

/** A `<TableHead>` that's also a sort-toggle link, with a chevron on whichever column is currently active. */
function SortableHead({
  sortKey,
  sort,
  baseHref,
  children,
}: {
  sortKey: TournamentSortKey;
  sort: TournamentSort;
  baseHref: string;
  children: React.ReactNode;
}) {
  const isActive = sort.key === sortKey;
  return (
    <TableHead>
      <Link
        href={buildSortHref(baseHref, sortKey, sort)}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {children}
        {isActive &&
          (sort.dir === "desc" ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronUpIcon className="size-3.5" />
          ))}
      </Link>
    </TableHead>
  );
}

/**
 * Every cell's content is its own real `<Link>` (not a "stretched" absolutely
 * positioned one over the whole row) - see clickable-table-row.tsx's comment
 * for why: `position: relative` doesn't reliably create a containing block
 * on table rows/cells in some browsers, so an absolutely positioned link can
 * escape and cover the entire table instead of just its own row. Real anchors
 * in each cell (`p-0` on the cell, padding moved onto the Link) get the same
 * whole-row-clickable feel without that risk, and ctrl/cmd/middle-click work
 * natively since these are real `<a>` elements, not a `router.push` handler.
 */
function LinkCell({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <TableCell className="p-0">
      <Link href={href} className={`block p-2 ${className ?? ""}`}>
        {children}
      </Link>
    </TableCell>
  );
}

export function TournamentsTable({
  tournaments,
  sort,
  baseHref,
}: {
  tournaments: TournamentListItem[];
  sort: TournamentSort;
  baseHref: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Назва</TableHead>
            <TableHead>Формат</TableHead>
            <TableHead>Покриття</TableHead>
            <TableHead>Статус</TableHead>
            <SortableHead sortKey="startDate" sort={sort} baseHref={baseHref}>
              Дати
            </SortableHead>
            <SortableHead sortKey="participants" sort={sort} baseHref={baseHref}>
              Учасників
            </SortableHead>
            <SortableHead sortKey="matches" sort={sort} baseHref={baseHref}>
              Матчів
            </SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tournaments.map((t) => {
            const href = `/admin/tournaments/${t.id}`;
            return (
              <TableRow key={t.id}>
                <LinkCell href={href} className="font-medium hover:underline">
                  {t.name}
                </LinkCell>
                <LinkCell href={href}>{TOURNAMENT_FORMAT_LABEL[t.format]}</LinkCell>
                <LinkCell href={href}>
                  <Badge variant={COURT_SURFACE_VARIANT[t.surface]}>
                    {COURT_SURFACE_LABEL[t.surface]}
                  </Badge>
                </LinkCell>
                <LinkCell href={href}>
                  <Badge variant={TOURNAMENT_STATUS_VARIANT[t.status]}>
                    {TOURNAMENT_STATUS_LABEL[t.status]}
                  </Badge>
                </LinkCell>
                <LinkCell href={href} className="text-muted-foreground">
                  {formatDateUTC(new Date(t.startDate))} – {formatDateUTC(new Date(t.endDate))}
                </LinkCell>
                <LinkCell href={href}>{t._count.participants}</LinkCell>
                <LinkCell href={href}>{t._count.matches}</LinkCell>
              </TableRow>
            );
          })}
          {tournaments.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                Нічого не знайдено.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
