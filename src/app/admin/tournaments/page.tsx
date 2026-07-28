import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { ClickableTableRow } from "@/components/admin/clickable-table-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countLabel, TOURNAMENT_FORMS } from "@/lib/pluralize";
import { getTournaments } from "@/lib/queries/tournaments";
import {
  COURT_SURFACE_LABEL,
  COURT_SURFACE_VARIANT,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_VARIANT,
} from "@/lib/validation/tournament";

export default async function AdminTournamentsPage() {
  const tournaments = await getTournaments();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {countLabel(tournaments.length, TOURNAMENT_FORMS)}
        </p>
        <Button render={<Link href="/admin/tournaments/new" />}>
          <PlusIcon /> Новий турнір
        </Button>
      </div>

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
          {tournaments.map((t) => (
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
          {tournaments.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                Ще немає жодного турніру.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
