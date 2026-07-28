"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ClickableTableRow } from "@/components/admin/clickable-table-row";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TournamentListItem } from "@/lib/queries/tournaments";
import {
  COURT_SURFACE_LABEL,
  COURT_SURFACE_VARIANT,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_VARIANT,
} from "@/lib/validation/tournament";

export function TournamentsTable({ tournaments }: { tournaments: TournamentListItem[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? tournaments.filter((t) => t.name.toLowerCase().includes(normalized))
    : tournaments;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Пошук за назвою"
          className="bg-card pl-8"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Назва</TableHead>
              <TableHead>Формат</TableHead>
              <TableHead>Покриття</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Дати</TableHead>
              <TableHead>Учасників</TableHead>
              <TableHead>Матчів</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <ClickableTableRow key={t.id} href={`/admin/tournaments/${t.id}`}>
                <TableCell className="font-medium">
                  <Link href={`/admin/tournaments/${t.id}`} className="hover:underline">
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell>{TOURNAMENT_FORMAT_LABEL[t.format]}</TableCell>
                <TableCell>
                  <Badge variant={COURT_SURFACE_VARIANT[t.surface]}>
                    {COURT_SURFACE_LABEL[t.surface]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={TOURNAMENT_STATUS_VARIANT[t.status]}>
                    {TOURNAMENT_STATUS_LABEL[t.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(t.startDate).toLocaleDateString("uk-UA")} –{" "}
                  {new Date(t.endDate).toLocaleDateString("uk-UA")}
                </TableCell>
                <TableCell>{t._count.participants}</TableCell>
                <TableCell>{t._count.matches}</TableCell>
              </ClickableTableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {tournaments.length === 0 ? "Ще немає жодного турніру." : "Нічого не знайдено."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
