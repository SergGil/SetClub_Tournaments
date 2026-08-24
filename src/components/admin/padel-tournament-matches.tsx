"use client";

import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon, Trophy } from "lucide-react";
import { useOptimistic, useState } from "react";

import { PadelMatchDialog } from "@/components/admin/create-padel-match-dialog";
import { DeletePadelMatchButton } from "@/components/admin/delete-padel-match-button";
import { PadelRandomizeMatchesButton } from "@/components/admin/padel-randomize-matches-button";
import { PadelScoreDialog } from "@/components/admin/padel-score-dialog";
import { PadelSinglesRandomizeButton } from "@/components/admin/padel-singles-randomize-button";
import { MatchSummary } from "@/components/match-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fullDisplayName } from "@/lib/player-display";
import type { PadelMatchStatusFilterValue, PadelMatchWithDetails } from "@/lib/queries/padel-matches";
import type { MatchPreview } from "@/lib/rating/match-preview";
import type { TournamentFormat } from "@/lib/validation/tournament";

const OPTIMISTIC_ID_PREFIX = "optimistic-";

const MATCH_STATUS_FILTER_VALUES = ["SCHEDULED", "COMPLETED"] as const satisfies readonly PadelMatchStatusFilterValue[];

const STATUS_FILTER_ALL = "ALL";
type StatusFilterSelection = PadelMatchStatusFilterValue | typeof STATUS_FILTER_ALL;
const STATUS_FILTER_LABEL: Record<StatusFilterSelection, string> = {
  [STATUS_FILTER_ALL]: "Усі статуси",
  SCHEDULED: "Заплановані",
  COMPLETED: "Завершені",
};

function sideLabel(players: PadelMatchWithDetails["players"], side: "A" | "B") {
  const names = players.filter((p) => p.side === side).map((p) => fullDisplayName(p.player));
  return names.length > 0 ? names.join(" / ") : `Сторона ${side}`;
}

/** Padel twin of tournament-matches.tsx. */
export function PadelTournamentMatches({
  tournamentId,
  format,
  roster,
  matches,
  seededCount,
  unseededCount,
  groupCounts,
  customGroupNames,
  previewByMatchId,
  singlesRankById,
  doublesRankById,
}: {
  tournamentId: string;
  format: TournamentFormat;
  roster: { id: string; name: string; nickname: string | null }[];
  matches: PadelMatchWithDetails[];
  seededCount: number;
  unseededCount: number;
  groupCounts: Record<number, number>;
  customGroupNames: Map<number, string>;
  previewByMatchId: Record<string, MatchPreview | null>;
  singlesRankById: Record<string, number>;
  doublesRankById: Record<string, number>;
}) {
  const [optimisticMatches, addOptimisticMatch] = useOptimistic(
    matches,
    (state, added: PadelMatchWithDetails) => [added, ...state],
  );
  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const completedMatchCount = matches.filter((m) => m.status === "COMPLETED").length;
  const customGroupNameList = [...customGroupNames.values()];

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterSelection>(STATUS_FILTER_ALL);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredMatches = optimisticMatches.filter((match) => {
    if (statusFilter !== STATUS_FILTER_ALL && match.status !== statusFilter) return false;
    if (!normalizedQuery) return true;
    return match.players.some(
      (p) =>
        p.player.name.toLowerCase().includes(normalizedQuery) ||
        p.player.nickname?.toLowerCase().includes(normalizedQuery),
    );
  });

  function optimisticCreate(input: {
    matchType: PadelMatchWithDetails["matchType"];
    round: string | null;
    scheduledDate: string | null;
    sideAPlayerIds: string[];
    sideBPlayerIds: string[];
  }) {
    const now = new Date();
    addOptimisticMatch({
      id: `${OPTIMISTIC_ID_PREFIX}${now.getTime()}`,
      tournamentId,
      round: input.round,
      matchType: input.matchType,
      scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
      status: "SCHEDULED",
      winnerSide: null,
      retired: false,
      walkover: false,
      tieId: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      tournament: { id: tournamentId, name: "" },
      sets: [],
      players: [
        ...input.sideAPlayerIds.flatMap((playerId, i) => {
          const player = rosterById.get(playerId);
          return player
            ? [
                {
                  id: `optimistic-a${i}`,
                  matchId: "optimistic",
                  side: "A" as const,
                  playerId,
                  player: { ...player, gender: null, user: null },
                },
              ]
            : [];
        }),
        ...input.sideBPlayerIds.flatMap((playerId, i) => {
          const player = rosterById.get(playerId);
          return player
            ? [
                {
                  id: `optimistic-b${i}`,
                  matchId: "optimistic",
                  side: "B" as const,
                  playerId,
                  player: { ...player, gender: null, user: null },
                },
              ]
            : [];
        }),
      ],
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        {format === "DOUBLES" && (
          <PadelRandomizeMatchesButton
            tournamentId={tournamentId}
            roster={roster}
            groupCounts={groupCounts}
            customGroupNames={customGroupNames}
            hasMatches={matches.length > 0}
            completedMatchCount={completedMatchCount}
          />
        )}
        {format === "SINGLES" && (
          <PadelSinglesRandomizeButton
            tournamentId={tournamentId}
            seededCount={seededCount}
            unseededCount={unseededCount}
            groupCounts={groupCounts}
            customGroupNames={customGroupNames}
            hasMatches={matches.length > 0}
            completedMatchCount={completedMatchCount}
          />
        )}
        <PadelMatchDialog
          tournamentId={tournamentId}
          format={format}
          roster={roster}
          onOptimisticCreate={optimisticCreate}
          customGroupNames={customGroupNameList}
          trigger={
            <Button>
              <PlusIcon /> Додати матч
            </Button>
          }
        />
      </div>

      {optimisticMatches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Пошук за гравцем"
              className="bg-card pl-8"
            />
          </div>
          <Select
            items={STATUS_FILTER_LABEL}
            value={statusFilter}
            onValueChange={(value) => setStatusFilter((value as StatusFilterSelection) ?? STATUS_FILTER_ALL)}
          >
            <SelectTrigger className="w-44" aria-label="Фільтр за статусом">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[STATUS_FILTER_ALL, ...MATCH_STATUS_FILTER_VALUES].map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_FILTER_LABEL[value as StatusFilterSelection]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filteredMatches.map((match) => {
          const isOptimistic = match.id.startsWith(OPTIMISTIC_ID_PREFIX);
          return (
            <div key={match.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1">
                <MatchSummary
                  match={match}
                  showTournament={false}
                  sport="PADEL"
                  preview={match.status === "SCHEDULED" ? previewByMatchId[match.id] : undefined}
                  singlesRankById={singlesRankById}
                  doublesRankById={doublesRankById}
                />
              </div>
              <div className="flex items-center gap-1 self-end sm:shrink-0 sm:self-auto">
                {match.status !== "CANCELLED" &&
                  (isOptimistic ? (
                    <Button variant="outline" size="sm" disabled title="Матч ще створюється…">
                      <Trophy /> Рахунок
                    </Button>
                  ) : (
                    <PadelScoreDialog
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
                  ))}
                {isOptimistic ? (
                  <Button variant="ghost" size="icon-sm" disabled title="Матч ще створюється…">
                    <PencilIcon />
                    <span className="sr-only">Редагувати</span>
                  </Button>
                ) : (
                  <PadelMatchDialog
                    tournamentId={tournamentId}
                    format={format}
                    roster={roster}
                    customGroupNames={customGroupNameList}
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
                )}
                {isOptimistic ? (
                  <Button variant="ghost" size="icon-sm" disabled title="Матч ще створюється…">
                    <Trash2Icon />
                    <span className="sr-only">Видалити</span>
                  </Button>
                ) : (
                  <DeletePadelMatchButton matchId={match.id} />
                )}
              </div>
            </div>
          );
        })}
        {optimisticMatches.length === 0 && (
          <p className="text-sm text-foreground/80">Матчів ще не створено.</p>
        )}
        {optimisticMatches.length > 0 && filteredMatches.length === 0 && (
          <p className="text-sm text-foreground/80">Немає матчів за цим фільтром.</p>
        )}
      </div>
    </div>
  );
}
