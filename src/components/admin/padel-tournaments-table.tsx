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
import type { PadelTournamentListItem, PadelTournamentSort, PadelTournamentSortKey } from "@/lib/queries/padel-tournaments";
import {
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_VARIANT,
} from "@/lib/validation/tournament";

/** Padel twin of tournaments-table.tsx - no "Покриття" (surface) column, Padel tournaments have no CourtSurface field. */
function buildSortHref(baseHref: string, key: PadelTournamentSortKey, sort: PadelTournamentSort): string {
  const nextDir = sort.key === key && sort.dir === "desc" ? "asc" : "desc";
  const url = new URL(baseHref, "http://placeholder");
  url.searchParams.set("sort", key);
  url.searchParams.set("dir", nextDir);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function SortableHead({
  sortKey,
  sort,
  baseHref,
  className,
  children,
}: {
  sortKey: PadelTournamentSortKey;
  sort: PadelTournamentSort;
  baseHref: string;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = sort.key === sortKey;
  return (
    <TableHead
      className={className}
      aria-sort={isActive ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
    >
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

const HIDDEN_ON_MOBILE = "hidden md:table-cell";

function LinkCell({
  href,
  className,
  cellClassName,
  children,
}: {
  href: string;
  className?: string;
  cellClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <TableCell className={`p-0 ${cellClassName ?? ""}`}>
      <Link href={href} className={`block p-2 ${className ?? ""}`}>
        {children}
      </Link>
    </TableCell>
  );
}

export function PadelTournamentsTable({
  tournaments,
  sort,
  baseHref,
}: {
  tournaments: PadelTournamentListItem[];
  sort: PadelTournamentSort;
  baseHref: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Назва</TableHead>
            <TableHead className={HIDDEN_ON_MOBILE}>Формат</TableHead>
            <TableHead>Статус</TableHead>
            <SortableHead sortKey="startDate" sort={sort} baseHref={baseHref}>
              Дати
            </SortableHead>
            <SortableHead
              sortKey="participants"
              sort={sort}
              baseHref={baseHref}
              className={HIDDEN_ON_MOBILE}
            >
              Учасників
            </SortableHead>
            <SortableHead sortKey="matches" sort={sort} baseHref={baseHref}>
              Матчів
            </SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tournaments.map((t) => {
            const href = `/admin/padel/tournaments/${t.id}`;
            return (
              <TableRow key={t.id}>
                <LinkCell href={href} className="font-medium hover:underline">
                  {t.name}
                </LinkCell>
                <LinkCell href={href} cellClassName={HIDDEN_ON_MOBILE}>
                  {TOURNAMENT_FORMAT_LABEL[t.format]}
                </LinkCell>
                <LinkCell href={href}>
                  <Badge variant={TOURNAMENT_STATUS_VARIANT[t.status]}>
                    {TOURNAMENT_STATUS_LABEL[t.status]}
                  </Badge>
                </LinkCell>
                <LinkCell href={href} className="text-muted-foreground">
                  {formatDateUTC(new Date(t.startDate))} – {formatDateUTC(new Date(t.endDate))}
                </LinkCell>
                <LinkCell href={href} cellClassName={HIDDEN_ON_MOBILE}>
                  {t._count.participants}
                </LinkCell>
                <LinkCell href={href}>{t._count.matches}</LinkCell>
              </TableRow>
            );
          })}
          {tournaments.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Нічого не знайдено.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
