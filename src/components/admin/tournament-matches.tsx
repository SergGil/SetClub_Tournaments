import { PencilIcon, PlusIcon, Trophy } from "lucide-react";

import { MatchDialog } from "@/components/admin/create-match-dialog";
import { DeleteMatchButton } from "@/components/admin/delete-match-button";
import { RandomizeMatchesButton } from "@/components/admin/randomize-matches-button";
import { ScoreDialog } from "@/components/admin/score-dialog";
import { SinglesRandomizeButton } from "@/components/admin/singles-randomize-button";
import { MatchSummary } from "@/components/match-summary";
import { Button } from "@/components/ui/button";
import type { MatchWithDetails } from "@/lib/queries/matches";
import type { TournamentFormat } from "@/lib/validation/tournament";

function sideLabel(players: MatchWithDetails["players"], side: "A" | "B") {
  const names = players.filter((p) => p.side === side).map((p) => p.player.name);
  return names.length > 0 ? names.join(" / ") : `Сторона ${side}`;
}

export function TournamentMatches({
  tournamentId,
  format,
  roster,
  matches,
  hasSeededPlayer,
}: {
  tournamentId: string;
  format: TournamentFormat;
  roster: { id: string; name: string }[];
  matches: MatchWithDetails[];
  hasSeededPlayer: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        {format === "DOUBLES" && (
          <RandomizeMatchesButton
            tournamentId={tournamentId}
            hasSeededPlayer={hasSeededPlayer}
            hasMatches={matches.length > 0}
          />
        )}
        {format === "SINGLES" && (
          <SinglesRandomizeButton
            tournamentId={tournamentId}
            participantCount={roster.length}
            hasMatches={matches.length > 0}
          />
        )}
        <MatchDialog
          tournamentId={tournamentId}
          format={format}
          roster={roster}
          trigger={
            <Button>
              <PlusIcon /> Додати матч
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        {matches.map((match) => (
          <div key={match.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <MatchSummary match={match} showTournament={false} />
            </div>
            <div className="flex items-center gap-1 self-end sm:shrink-0 sm:self-auto">
              {match.status !== "CANCELLED" && (
                <ScoreDialog
                  matchId={match.id}
                  tournamentId={tournamentId}
                  sideALabel={sideLabel(match.players, "A")}
                  sideBLabel={sideLabel(match.players, "B")}
                  initialSets={match.sets}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Trophy /> Рахунок
                    </Button>
                  }
                />
              )}
              <MatchDialog
                tournamentId={tournamentId}
                format={format}
                roster={roster}
                match={{
                  id: match.id,
                  matchType: match.matchType,
                  round: match.round,
                  scheduledDate: match.scheduledDate,
                  sideAPlayerIds: match.players
                    .filter((p) => p.side === "A")
                    .map((p) => p.playerId),
                  sideBPlayerIds: match.players
                    .filter((p) => p.side === "B")
                    .map((p) => p.playerId),
                }}
                trigger={
                  <Button variant="ghost" size="icon-sm">
                    <PencilIcon />
                    <span className="sr-only">Редагувати</span>
                  </Button>
                }
              />
              <DeleteMatchButton matchId={match.id} tournamentId={tournamentId} />
            </div>
          </div>
        ))}
        {matches.length === 0 && (
          <p className="text-sm text-muted-foreground">Матчів ще не створено.</p>
        )}
      </div>
    </div>
  );
}
