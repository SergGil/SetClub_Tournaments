import { Trophy } from "lucide-react";

import { CreateMatchDialog } from "@/components/admin/create-match-dialog";
import { DeleteMatchButton } from "@/components/admin/delete-match-button";
import { RandomizeMatchesButton } from "@/components/admin/randomize-matches-button";
import { ScoreDialog } from "@/components/admin/score-dialog";
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
}: {
  tournamentId: string;
  format: TournamentFormat;
  roster: { id: string; name: string }[];
  matches: MatchWithDetails[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        {format === "DOUBLES" && <RandomizeMatchesButton tournamentId={tournamentId} />}
        <CreateMatchDialog tournamentId={tournamentId} format={format} roster={roster} />
      </div>

      <div className="flex flex-col gap-2">
        {matches.map((match) => (
          <div key={match.id} className="flex items-center gap-2">
            <div className="flex-1">
              <MatchSummary match={match} showTournament={false} />
            </div>
            <div className="flex shrink-0 items-center gap-1">
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
