import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { MatchWithDetails } from "@/lib/queries/matches";

const MATCH_TYPE_LABEL = { SINGLES: "1×1", DOUBLES: "2×2" } as const;
const MATCH_TYPE_VARIANT = { SINGLES: "accent", DOUBLES: "teal" } as const;

function formatSide(players: MatchWithDetails["players"], side: "A" | "B") {
  return players
    .filter((p) => p.side === side)
    .map((p) => p.player.name)
    .join(" / ");
}

function formatScore(sets: MatchWithDetails["sets"]) {
  if (sets.length === 0) return null;
  return sets.map((set) => `${set.sideAGames}–${set.sideBGames}`).join(", ");
}

export function MatchSummary({
  match,
  perspectivePlayerId,
  showTournament = true,
}: {
  match: MatchWithDetails;
  perspectivePlayerId?: string;
  showTournament?: boolean;
}) {
  const sideA = formatSide(match.players, "A");
  const sideB = formatSide(match.players, "B");
  const score = formatScore(match.sets);

  const perspectiveSide = perspectivePlayerId
    ? match.players.find((p) => p.playerId === perspectivePlayerId)?.side
    : undefined;

  const resultBadge = (() => {
    if (match.status === "CANCELLED") return <Badge variant="secondary">Скасовано</Badge>;
    if (match.status === "SCHEDULED") return <Badge variant="info">Заплановано</Badge>;
    if (!perspectiveSide) return <Badge variant="secondary">Завершено</Badge>;
    const won = match.winnerSide === perspectiveSide;
    return (
      <Badge variant={won ? "default" : "destructive"}>{won ? "Перемога" : "Поразка"}</Badge>
    );
  })();

  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Badge variant={MATCH_TYPE_VARIANT[match.matchType]}>
            {MATCH_TYPE_LABEL[match.matchType]}
          </Badge>
          {match.round && <span>{match.round}</span>}
          {match.scheduledDate && (
            <span>{new Date(match.scheduledDate).toLocaleDateString("uk-UA")}</span>
          )}
        </div>
        {resultBadge}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="font-medium break-words">
          {sideA || "?"} <span className="text-muted-foreground">проти</span> {sideB || "?"}
        </span>
        {score && <span className="tabular-nums text-muted-foreground">{score}</span>}
      </div>
      {showTournament && (
        <Link
          href={`/tournaments/${match.tournament.id}`}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {match.tournament.name}
        </Link>
      )}
    </div>
  );
}
