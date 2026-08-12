import { DownloadIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TournamentsTable } from "@/components/admin/tournaments-table";
import { LoadMore } from "@/components/load-more";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseShowParam } from "@/lib/load-more";
import { isDomainAdmin } from "@/lib/permissions";
import { countLabel, TOURNAMENT_FORMS } from "@/lib/pluralize";
import { getTournamentsPage } from "@/lib/queries/tournaments";
import type { TournamentSortKey } from "@/lib/queries/tournaments";

const PAGE_SIZE = 20;
const SORT_KEYS: TournamentSortKey[] = ["startDate", "participants", "matches"];

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; q?: string; sort?: string; dir?: string }>;
}) {
  // AdminLayout only checks for *some* admin access - Tournaments is TENNIS
  // domain territory, so a COFFEE/PADEL-only admin (or a superadmin's absence
  // of it) shouldn't be able to reach it by URL even though AdminNav already
  // hides the link.
  if (!(await isDomainAdmin("TENNIS"))) {
    redirect("/admin");
  }

  const { show: showParam, q: query, sort: sortParam, dir: dirParam } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const sort = {
    key: (SORT_KEYS as string[]).includes(sortParam ?? "") ? (sortParam as TournamentSortKey) : "startDate",
    dir: dirParam === "asc" ? ("asc" as const) : ("desc" as const),
  };
  const { tournaments, total } = await getTournamentsPage(shown, query, sort);
  const baseHref = `/admin/tournaments${query ? `?q=${encodeURIComponent(query)}` : ""}`;

  function buildShowMoreHref(nextShown: number): string {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("sort", sort.key);
    params.set("dir", sort.dir);
    params.set("show", String(nextShown));
    return `/admin/tournaments?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/80">{countLabel(total, TOURNAMENT_FORMS)}</p>
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

      <SearchInput placeholder="Пошук за назвою" defaultValue={query} />

      <TournamentsTable tournaments={tournaments} sort={sort} baseHref={baseHref} />

      <LoadMore
        shown={tournaments.length}
        total={total}
        href={buildShowMoreHref(shown + PAGE_SIZE)}
        label={`Показано ${tournaments.length} з ${countLabel(total, TOURNAMENT_FORMS)}`}
      />
    </div>
  );
}
