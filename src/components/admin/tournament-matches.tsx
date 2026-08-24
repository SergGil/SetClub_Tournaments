"use client";

import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon, Trophy } from "lucide-react";
import { useOptimistic, useState } from "react";

import { MatchDialog } from "@/components/admin/create-match-dialog";
import { DeleteMatchButton } from "@/components/admin/delete-match-button";
import { RandomizeMatchesButton } from "@/components/admin/randomize-matches-button";
import { ScoreDialog } from "@/components/admin/score-dialog";
import { SinglesRandomizeButton } from "@/components/admin/singles-randomize-button";
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
import type { MatchStatusFilterValue, MatchWithDetails } from "@/lib/queries/matches";
import type { MatchPreview } from "@/lib/rating/match-preview";
import type { TournamentFormat } from "@/lib/validation/tournament";

// Prefixes the fake id optimisticCreate gives a not-yet-persisted match, so
// its action buttons (score/edit/delete) can tell it apart from a real one
// and disable themselves - none of those actions have a real matchId to act
// on yet, and would otherwise fail with "not found" if clicked too fast.
const OPTIMISTIC_ID_PREFIX = "optimistic-";

// Kept in sync with (but not imported from) MATCH_STATUS_FILTER_VALUES in
// lib/queries/matches.ts - that module also exports Prisma-backed query
// functions, and importing a runtime value from it here would pull prisma's
// client into this "use client" component's browser bundle. CANCELLED is
// excluded for the same reason it is there: nothing in the app ever sets a
// match to it, so offering it as a filter would only ever show 0 matches.
const MATCH_STATUS_FILTER_VALUES = ["SCHEDULED", "COMPLETED"] as const satisfies readonly MatchStatusFilterValue[];

const STATUS_FILTER_ALL = "ALL";
type StatusFilterSelection = MatchStatusFilterValue | typeof STATUS_FILTER_ALL;
const STATUS_FILTER_LABEL: Record<StatusFilterSelection, string> = {
  [STATUS_FILTER_ALL]: "Усі статуси",
  SCHEDULED: "Заплановані",
  COMPLETED: "Завершені",
};

function sideLabel(players: MatchWithDetails["players"], side: "A" | "B") {
  const names = players.filter((p) => p.side === side).map((p) => fullDisplayName(p.player));
  return names.length > 0 ? names.join(" / ") : `Сторона ${side}`;
}

export function TournamentMatches({
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
  matches: MatchWithDetails[];
  seededCount: number;
  unseededCount: number;
  groupCounts: Record<number, number>;
  /** Names for group numbers beyond the built-in 1-6 (A-F) range - see createTournamentGroupAction. */
  customGroupNames: Map<number, string>;
  /** Win-probability preview per SCHEDULED match id - null means "computed, not enough data", absent (optimistic matches) falls back to undefined. */
  previewByMatchId: Record<string, MatchPreview | null>;
  singlesRankById: Record<string, number>;
  doublesRankById: Record<string, number>;
}) {
  // Shows a just-created match immediately instead of waiting on the
  // mutation + revalidation round-trip - reconciles automatically once the
  // real `matches` prop catches up.
  const [optimisticMatches, addOptimisticMatch] = useOptimistic(
    matches,
    (state, added: MatchWithDetails) => [added, ...state],
  );
  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const completedMatchCount = matches.filter((m) => m.status === "COMPLETED").length;
  // customGroupNames' values (keyed by number for resolveGroupLabel's own
  // purposes) are exactly this tournament's "Додаткові групи" names - reused
  // here as-is for MatchDialog's Раунд picker, see its own prop doc comment.
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
    matchType: MatchWithDetails["matchType"];
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
          <RandomizeMatchesButton
            tournamentId={tournamentId}
            roster={roster}
            groupCounts={groupCounts}
            customGroupNames={customGroupNames}
            hasMatches={matches.length > 0}
            completedMatchCount={completedMatchCount}
          />
        )}
        {format === "SINGLES" && (
          <SinglesRandomizeButton
            tournamentId={tournamentId}
            seededCount={seededCount}
            unseededCount={unseededCount}
            groupCounts={groupCounts}
            customGroupNames={customGroupNames}
            hasMatches={matches.length > 0}
            completedMatchCount={completedMatchCount}
          />
        )}
        <MatchDialog
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
                  ))}
                {isOptimistic ? (
                  <Button variant="ghost" size="icon-sm" disabled title="Матч ще створюється…">
                    <PencilIcon />
                    <span className="sr-only">Редагувати</span>
                  </Button>
                ) : (
                  <MatchDialog
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
                  <DeleteMatchButton matchId={match.id} />
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
