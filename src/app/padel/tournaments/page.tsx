import Link from "next/link";

import { LoadMore } from "@/components/load-more";
import { PillFilterGroup, PillFilterLink } from "@/components/pill-filter";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateUTC } from "@/lib/date-format";
import { parseShowParam } from "@/lib/load-more";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS, TOURNAMENT_FORMS } from "@/lib/pluralize";
import { getPadelTournamentsPage } from "@/lib/queries/padel-tournaments";
import {
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_VARIANT,
} from "@/lib/validation/tournament";
import type { TournamentFormat } from "@/lib/validation/tournament";

export const metadata = { title: "Турніри (Падел)" };

const PAGE_SIZE = 20;

const FORMAT_FILTERS: { value: TournamentFormat | undefined; label: string }[] = [
  { value: undefined, label: "Усі" },
  { value: "SINGLES", label: "Одиночні" },
  { value: "DOUBLES", label: "Парні" },
];

function buildHref(shown: number, query: string | undefined, format: TournamentFormat | undefined): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (format) params.set("format", format);
  if (shown !== PAGE_SIZE) params.set("show", String(shown));
  const qs = params.toString();
  return qs ? `/padel/tournaments?${qs}` : "/padel/tournaments";
}

export default async function PadelTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; q?: string; format?: string }>;
}) {
  const { show: showParam, q: query, format: formatParam } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const activeFormat: TournamentFormat | undefined =
    formatParam === "SINGLES" || formatParam === "DOUBLES" ? formatParam : undefined;
  const { tournaments, total } = await getPadelTournamentsPage(shown, query, undefined, activeFormat);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Турніри (Падел)</h1>
        <SearchInput placeholder="Пошук турніру…" defaultValue={query} />
      </div>

      <PillFilterGroup>
        {FORMAT_FILTERS.map((filter) => (
          <PillFilterLink
            key={filter.label}
            href={buildHref(PAGE_SIZE, query, filter.value)}
            active={filter.value === activeFormat}
          >
            {filter.label}
          </PillFilterLink>
        ))}
      </PillFilterGroup>

      <div className="grid gap-4 sm:grid-cols-2">
        {tournaments.map((t) => (
          <Link key={t.id} href={`/padel/tournaments/${t.id}`}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant={TOURNAMENT_STATUS_VARIANT[t.status]}>
                    {TOURNAMENT_STATUS_LABEL[t.status]}
                  </Badge>
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
            {query
              ? `Нічого не знайдено за запитом «${query}».`
              : activeFormat
                ? `Ще немає жодного турніру формату «${TOURNAMENT_FORMAT_LABEL[activeFormat]}».`
                : "Ще немає жодного турніру."}
          </p>
        )}
      </div>
      <LoadMore
        shown={tournaments.length}
        total={total}
        href={buildHref(shown + PAGE_SIZE, query, activeFormat)}
        label={`Показано ${tournaments.length} з ${countLabel(total, TOURNAMENT_FORMS)}`}
      />
    </div>
  );
}
