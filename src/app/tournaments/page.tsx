import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS } from "@/lib/pluralize";
import { getTournaments } from "@/lib/queries/tournaments";
import {
  COURT_SURFACE_LABEL,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_VARIANT,
} from "@/lib/validation/tournament";

export const metadata = { title: "Турніри" };

export default async function TournamentsPage() {
  const tournaments = await getTournaments();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Турніри</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {tournaments.map((t) => (
          <Link key={t.id} href={`/tournaments/${t.id}`}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant={TOURNAMENT_STATUS_VARIANT[t.status]}>
                    {TOURNAMENT_STATUS_LABEL[t.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p>
                  {TOURNAMENT_FORMAT_LABEL[t.format]} · {COURT_SURFACE_LABEL[t.surface]}
                </p>
                <p>
                  {new Date(t.startDate).toLocaleDateString("uk-UA")} –{" "}
                  {new Date(t.endDate).toLocaleDateString("uk-UA")}
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
          <p className="text-muted-foreground">Ще немає жодного турніру.</p>
        )}
      </div>
    </div>
  );
}
