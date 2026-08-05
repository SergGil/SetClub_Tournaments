import Link from "next/link";

import { LoadMore } from "@/components/load-more";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateUTC } from "@/lib/date-format";
import { parseShowParam } from "@/lib/load-more";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS, TOURNAMENT_FORMS } from "@/lib/pluralize";
import { getTournamentsPage } from "@/lib/queries/tournaments";
import {
  COURT_SURFACE_LABEL,
  COURT_SURFACE_VARIANT,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_VARIANT,
} from "@/lib/validation/tournament";

export const metadata = { title: "Турніри" };

const PAGE_SIZE = 20;

function buildShowMoreHref(shown: number, query: string | undefined): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("show", String(shown));
  return `/tournaments?${params.toString()}`;
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; q?: string }>;
}) {
  const { show: showParam, q: query } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const { tournaments, total } = await getTournamentsPage(shown, query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Турніри</h1>
        <SearchInput placeholder="Пошук турніру…" defaultValue={query} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tournaments.map((t) => (
          <Link key={t.id} href={`/tournaments/${t.id}`}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={TOURNAMENT_STATUS_VARIANT[t.status]}>
                      {TOURNAMENT_STATUS_LABEL[t.status]}
                    </Badge>
                    <Badge variant={COURT_SURFACE_VARIANT[t.surface]}>
                      {COURT_SURFACE_LABEL[t.surface]}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p>{TOURNAMENT_FORMAT_LABEL[t.format]}</p>
                <p>
                  {formatDateUTC(t.startDate)} – {formatDateUTC(t.endDate)}
                </p>
                <p>
                  {countLabel(t._count.participants, PARTICIPANT_FORMS)} ·{" "}
                  {countLabel(t._count.matches, MATCH_FORMS)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {tournaments.length === 0 && (
          <p className="text-foreground/80">
            {query ? `Нічого не знайдено за запитом «${query}».` : "Ще немає жодного турніру."}
          </p>
        )}
      </div>
      <LoadMore
        shown={tournaments.length}
        total={total}
        href={buildShowMoreHref(shown + PAGE_SIZE, query)}
        label={`Показано ${tournaments.length} з ${countLabel(total, TOURNAMENT_FORMS)}`}
      />
    </div>
  );
}
