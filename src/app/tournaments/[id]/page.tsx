import { PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PhotoUploadDialog } from "@/components/admin/photo-upload-dialog";
import { FormatRulesButton } from "@/components/format-rules-info";
import { MatchSummary } from "@/components/match-summary";
import { TournamentGallery } from "@/components/tournament-gallery";
import { TournamentPlayoffs } from "@/components/tournament-playoffs";
import { TournamentStandingsSection } from "@/components/tournament-standings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateUTC } from "@/lib/date-format";
import { hasFinalMatch, isPlayoffRound } from "@/lib/playoff-rounds";
import { getSession } from "@/lib/permissions";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS } from "@/lib/pluralize";
import { getTournamentMatches } from "@/lib/queries/matches";
import { getTournamentById } from "@/lib/queries/tournaments";
import { buildMatchPreview } from "@/lib/rating/match-preview";
import {
  getDoublesRatings,
  getDoublesSetClubPoints,
  getSinglesRatings,
  getSinglesSetClubPoints,
  ROLLING_SEASON,
} from "@/lib/rating/ratings-data";
import { getTournamentStandingsRows } from "@/lib/tournament-standings";
import {
  COURT_SURFACE_LABEL,
  COURT_SURFACE_VARIANT,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_VARIANT,
} from "@/lib/validation/tournament";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  return { title: tournament?.name ?? "Турнір" };
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) notFound();

  const [
    matches,
    standings,
    session,
    singlesRatings,
    doublesRatings,
    singlesSetClubPoints,
    doublesSetClubPoints,
  ] = await Promise.all([
    getTournamentMatches(id),
    getTournamentStandingsRows(id, tournament.format, tournament.participants),
    getSession(),
    getSinglesRatings(),
    getDoublesRatings(),
    getSinglesSetClubPoints(ROLLING_SEASON),
    getDoublesSetClubPoints(ROLLING_SEASON),
  ]);
  const isAdmin = session?.user?.role === "ADMIN";
  const tournamentHasFinal = hasFinalMatch(matches);
  // Playoff matches (Фінал/За 3 місце/etc) already get their own read-only
  // summary in TournamentPlayoffs above - listing them again in the flat
  // list below would just be a duplicate, since this page has no editing UI
  // either way (unlike the admin "Матчі" tab, which is the actual
  // management surface and intentionally still shows every match).
  const groupStageMatches = matches.filter((match) => !isPlayoffRound(match.round));
  const singlesRatingById = new Map(singlesRatings.map((r) => [r.playerId, r.rating]));
  const doublesRatingById = new Map(doublesRatings.map((r) => [r.playerId, r.rating]));
  const singlesPointsById = new Map(singlesSetClubPoints.map((r) => [r.playerId, r.points]));
  const doublesPointsById = new Map(doublesSetClubPoints.map((r) => [r.playerId, r.points]));
  const singlesRankById = Object.fromEntries(singlesSetClubPoints.map((r, i) => [r.playerId, i + 1]));
  const doublesRankById = Object.fromEntries(doublesSetClubPoints.map((r, i) => [r.playerId, i + 1]));

  return (
    <div className="flex flex-col gap-8">
      <Link href="/tournaments" className="text-sm text-foreground/80 hover:text-foreground">
        ← Усі турніри
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
            <Badge variant={TOURNAMENT_STATUS_VARIANT[tournament.status]}>
              {TOURNAMENT_STATUS_LABEL[tournament.status]}
            </Badge>
            <Badge variant={COURT_SURFACE_VARIANT[tournament.surface]}>
              {COURT_SURFACE_LABEL[tournament.surface]}
            </Badge>
            {standings.formatRulesKind && (
              <FormatRulesButton kind={standings.formatRulesKind} format={tournament.format} />
            )}
          </div>
          <p className="mt-1 text-sm text-foreground/80">
            {TOURNAMENT_FORMAT_LABEL[tournament.format]} · {formatDateUTC(new Date(tournament.startDate))} –{" "}
            {formatDateUTC(new Date(tournament.endDate))}
          </p>
          {tournament.description && <p className="mt-3 max-w-xl text-sm">{tournament.description}</p>}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <PhotoUploadDialog tournamentId={tournament.id} />
            <Button variant="outline" render={<Link href={`/admin/tournaments/${tournament.id}`} />}>
              <PencilIcon /> Керувати
            </Button>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          {countLabel(tournament.participants.length, PARTICIPANT_FORMS)}
        </h2>
        <TournamentStandingsSection
          standings={standings}
          showWinner={tournament.status === "COMPLETED"}
          hasPlayoffFinal={tournamentHasFinal}
          tournamentId={tournament.id}
          emptyMessage={
            tournament.format === "DOUBLES" ? "Пар ще не сформовано." : "Учасників ще не додано."
          }
        />
      </div>

      <TournamentPlayoffs
        matches={matches}
        singlesRankById={singlesRankById}
        doublesRankById={doublesRankById}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">{countLabel(groupStageMatches.length, MATCH_FORMS)}</h2>
        <div className="flex flex-col gap-2">
          {groupStageMatches.map((match) => (
            <MatchSummary
              key={match.id}
              match={match}
              showTournament={false}
              preview={
                match.status === "SCHEDULED"
                  ? buildMatchPreview(
                      match,
                      singlesRatingById,
                      doublesRatingById,
                      singlesPointsById,
                      doublesPointsById,
                    )
                  : undefined
              }
              singlesRankById={singlesRankById}
              doublesRankById={doublesRankById}
            />
          ))}
          {groupStageMatches.length === 0 && (
            <p className="text-sm text-foreground/80">Матчів ще не заплановано.</p>
          )}
        </div>
      </div>

      <TournamentGallery tournamentId={tournament.id} canManage={isAdmin} />
    </div>
  );
}
