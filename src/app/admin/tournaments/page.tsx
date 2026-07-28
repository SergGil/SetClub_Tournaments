import { DownloadIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { TournamentsTable } from "@/components/admin/tournaments-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { countLabel, TOURNAMENT_FORMS } from "@/lib/pluralize";
import { getTournaments } from "@/lib/queries/tournaments";

export default async function AdminTournamentsPage() {
  const tournaments = await getTournaments();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/80">
          {countLabel(tournaments.length, TOURNAMENT_FORMS)}
        </p>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <DownloadIcon /> Експортувати CSV
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href="/admin/tournaments/export" />}>
                Турніри
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/admin/tournaments/export/participants" />}>
                Учасники
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/admin/tournaments/export/matches" />}>
                Матчі
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button render={<Link href="/admin/tournaments/new" />}>
            <PlusIcon /> Додати турнір
          </Button>
        </div>
      </div>

      <TournamentsTable tournaments={tournaments} />
    </div>
  );
}
