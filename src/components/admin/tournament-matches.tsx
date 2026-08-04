"use client";

import { PencilIcon, PlusIcon, Trophy } from "lucide-react";
import { useOptimistic } from "react";

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
  seededCount,
  unseededCount,
  groupCounts,
}: {
  tournamentId: string;
  format: TournamentFormat;
  roster: { id: string; name: string }[];
  matches: MatchWithDetails[];
  hasSeededPlayer: boolean;
  seededCount: number;
  unseededCount: number;
  groupCounts: Record<number, number>;
}) {
  // Shows a just-created match immediately instead of waiting on the
  // mutation + revalidation round-trip - reconciles automatically once the
  // real `matches` prop catches up.
  const [optimisticMatches, addOptimisticMatch] = useOptimistic(
    matches,
    (state, added: MatchWithDetails) => [added, ...state],
  );
  const rosterById = new Map(roster.map((p) => [p.id, p]));

  function optimisticCreate(input: {
    matchType: MatchWithDetails["matchType"];
    round: string | null;
    scheduledDate: string | null;
    sideAPlayerIds: string[];
    sideBPlayerIds: string[];
  }) {
    const now = new Date();
    addOptimisticMatch({
      id: `optimistic-${now.getTime()}`,
      tournamentId,
      round: input.round,
      matchType: input.matchType,
      scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
      status: "SCHEDULED",
      winnerSide: null,
      retired: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      tournament: { id: tournamentId, name: "" },
      sets: [],
      players: [
        ...input.sideAPlayerIds.flatMap((playerId, i) => {
          const player = rosterById.get(playerId);
          return player
            ? [{ id: `optimistic-a${i}`, matchId: "optimistic", side: "A" as const, playerId, player }]
            : [];
        }),
        ...input.sideBPlayerIds.flatMap((playerId, i) => {
          const player = rosterById.get(playerId);
          return player
            ? [{ id: `optimistic-b${i}`, matchId: "optimistic", side: "B" as const, playerId, player }]
            : [];
        }),
      ],
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        {format === "DOUBLES" && (
          <RandomizeMatchesButton
            tournamentId={tournamentId}
            roster={roster}
            hasSeededPlayer={hasSeededPlayer}
            hasMatches={matches.length > 0}
          />
        )}
        {format === "SINGLES" && (
          <SinglesRandomizeButton
            tournamentId={tournamentId}
            seededCount={seededCount}
            unseededCount={unseededCount}
            groupCounts={groupCounts}
            hasMatches={matches.length > 0}
          />
        )}
        <MatchDialog
          tournamentId={tournamentId}
          format={format}
          roster={roster}
          onOptimisticCreate={optimisticCreate}
          trigger={
            <Button>
              <PlusIcon /> Додати матч
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        {optimisticMatches.map((match) => (
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
                  initialUpdatedAt={match.updatedAt}
                  initialRetired={match.retired}
                  initialWinnerSide={match.winnerSide}
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
              <DeleteMatchButton matchId={match.id} />
            </div>
          </div>
        ))}
        {optimisticMatches.length === 0 && (
          <p className="text-sm text-foreground/80">Матчів ще не створено.</p>
        )}
      </div>
    </div>
  );
}
