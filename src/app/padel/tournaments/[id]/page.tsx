import { PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PadelPhotoUploadDialog } from "@/components/admin/padel-photo-upload-dialog";
import { FormatRulesButton } from "@/components/format-rules-info";
import { MatchSummary } from "@/components/match-summary";
import { PadelTournamentGallery } from "@/components/padel-tournament-gallery";
import { ScrollToTopOnMount } from "@/components/scroll-to-top-on-mount";
import { TournamentPlayoffs } from "@/components/tournament-playoffs";
import { TournamentStandingsSection } from "@/components/tournament-standings";
import { TournamentTiesSection } from "@/components/tournament-ties-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateUTC } from "@/lib/date-format";
import { getPadelTeamTieStandings } from "@/lib/padel-tournament-ties";
import { getPadelTournamentStandingsRows } from "@/lib/padel-tournament-standings";
import { isDomainAdmin } from "@/lib/permissions";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS } from "@/lib/pluralize";
import { getPadelTournamentMatches } from "@/lib/queries/padel-matches";
import { getPadelTournamentById } from "@/lib/queries/padel-tournaments";
import { hasFinalMatch, isPlayoffRound } from "@/lib/playoff-rounds";
import { buildMatchPreview } from "@/lib/rating/match-preview";
import {
  getPadelDoublesRatings,
  getPadelDoublesSetClubPoints,
  getPadelSinglesRatings,
  getPadelSinglesSetClubPoints,
  PADEL_ROLLING_SEASON,
} from "@/lib/rating/padel-ratings-data";
import {
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
  const tournament = await getPadelTournamentById(id);
  return { title: tournament?.name ?? "Турнір (Падел)" };
}

export default async function PadelTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getPadelTournamentById(id);
  if (!tournament) notFound();

  const [
    matches,
    standings,
    isAdmin,
    singlesRatings,
    doublesRatings,
    singlesSetClubPoints,
    doublesSetClubPoints,
    teamTieStandings,
  ] = await Promise.all([
    getPadelTournamentMatches(id),
    getPadelTournamentStandingsRows(id, tournament.format, tournament.participants),
    isDomainAdmin("PADEL"),
    getPadelSinglesRatings(),
    getPadelDoublesRatings(),
    getPadelSinglesSetClubPoints(PADEL_ROLLING_SEASON),
    getPadelDoublesSetClubPoints(PADEL_ROLLING_SEASON),
    tournament.format === "MIXED" ? getPadelTeamTieStandings(id) : Promise.resolve(null),
  ]);
  const tournamentHasFinal = hasFinalMatch(matches);
  const groupStageMatches = matches.filter((match) => !isPlayoffRound(match.round) && match.tieId == null);
  const singlesRatingById = new Map(singlesRatings.map((r) => [r.playerId, r.rating]));
  const doublesRatingById = new Map(doublesRatings.map((r) => [r.playerId, r.rating]));
  const singlesPointsById = new Map(singlesSetClubPoints.map((r) => [r.playerId, r.points]));
  const doublesPointsById = new Map(doublesSetClubPoints.map((r) => [r.playerId, r.points]));
  const singlesRankById = Object.fromEntries(singlesSetClubPoints.map((r, i) => [r.playerId, i + 1]));
  const doublesRankById = Object.fromEntries(doublesSetClubPoints.map((r, i) => [r.playerId, i + 1]));

  return (
    <div className="flex flex-col gap-8">
      <ScrollToTopOnMount resetKey={id} />
      <Link href="/padel/tournaments" className="text-sm text-foreground/80 hover:text-foreground">
        ← Усі турніри
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
            <Badge variant={TOURNAMENT_STATUS_VARIANT[tournament.status]}>
              {TOURNAMENT_STATUS_LABEL[tournament.status]}
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
            <PadelPhotoUploadDialog tournamentId={tournament.id} />
            <Button variant="outline" render={<Link href={`/admin/padel/tournaments/${tournament.id}`} />}>
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
          tournamentName={tournament.name}
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

      {teamTieStandings && (
        <TournamentTiesSection
          tournamentId={tournament.id}
          ties={teamTieStandings.ties}
          standingsRows={teamTieStandings.rows}
          roundRobinDone={teamTieStandings.roundRobinDone}
        />
      )}

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

      <PadelTournamentGallery tournamentId={tournament.id} canManage={isAdmin} />
    </div>
  );
}
