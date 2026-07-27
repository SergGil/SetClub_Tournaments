import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTournaments } from "@/lib/queries/tournaments";
import { TOURNAMENT_FORMAT_LABEL, TOURNAMENT_STATUS_LABEL } from "@/lib/validation/tournament";

export default async function AdminTournamentsPage() {
  const tournaments = await getTournaments();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Турнірів: {tournaments.length}</p>
        <Button render={<Link href="/admin/tournaments/new" />}>
          <PlusIcon /> Новий турнір
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Назва</TableHead>
            <TableHead>Формат</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Дати</TableHead>
            <TableHead>Учасників</TableHead>
            <TableHead>Матчів</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tournaments.map((t) => (
            <TableRow key={t.id} className="relative cursor-pointer">
              <TableCell className="font-medium">
                <Link href={`/admin/tournaments/${t.id}`} className="absolute inset-0" />
                {t.name}
              </TableCell>
              <TableCell>{TOURNAMENT_FORMAT_LABEL[t.format]}</TableCell>
              <TableCell>
                <Badge variant="secondary">{TOURNAMENT_STATUS_LABEL[t.status]}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(t.startDate).toLocaleDateString("uk-UA")} –{" "}
                {new Date(t.endDate).toLocaleDateString("uk-UA")}
              </TableCell>
              <TableCell>{t._count.participants}</TableCell>
              <TableCell>{t._count.matches}</TableCell>
            </TableRow>
          ))}
          {tournaments.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Ще немає жодного турніру.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
