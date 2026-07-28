import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { OpponentFilter } from "@/components/opponent-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { countLabel, LOSS_FORMS, MATCH_FORMS, pluralizeUk, WIN_FORMS } from "@/lib/pluralize";
import { summarizePlayerStats } from "@/lib/player-stats";
import type { MatchPlayerRow } from "@/lib/player-stats";
import { getPlayerMatches } from "@/lib/queries/matches";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { getPlayerById } from "@/lib/queries/players";
import { getPlayerStats } from "@/lib/stats";

function ownSide(match: MatchWithDetails, playerId: string) {
  return match.players.find((p) => p.playerId === playerId)?.side;
}

/** True only if `opponentId` was on the *other* side from `playerId` in this match - not a teammate. */
function playedAgainst(match: MatchWithDetails, playerId: string, opponentId: string) {
  const own = ownSide(match, playerId);
  if (!own) return false;
  return match.players.some((p) => p.playerId === opponentId && p.side !== own);
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opponent?: string }>;
}) {
  const { id } = await params;
  const { opponent: opponentId } = await searchParams;
  const player = await getPlayerById(id);
  if (!player) notFound();

  const [stats, matches] = await Promise.all([getPlayerStats(id), getPlayerMatches(id)]);

  const opponentNameById = new Map<string, string>();
  for (const match of matches) {
    const own = ownSide(match, id);
    if (!own) continue;
    for (const p of match.players) {
      if (p.side !== own) opponentNameById.set(p.playerId, p.player.name);
    }
  }
  const opponents = Array.from(opponentNameById, ([opponentPlayerId, name]) => ({
    id: opponentPlayerId,
    name,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const selectedOpponent = opponentId ? opponents.find((o) => o.id === opponentId) : undefined;
  const visibleMatches = selectedOpponent
    ? matches.filter((m) => playedAgainst(m, id, selectedOpponent.id))
    : matches;

  const h2hRows: MatchPlayerRow[] = selectedOpponent
    ? visibleMatches
        .filter((m) => m.status === "COMPLETED" && m.winnerSide !== null)
        .map((m) => ({
          side: ownSide(m, id)!,
          match: { winnerSide: m.winnerSide, sets: m.sets, tournamentId: m.tournament.id },
        }))
    : [];
  const h2hStats = selectedOpponent ? summarizePlayerStats(id, h2hRows) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarImage src={player.user?.image ?? undefined} alt={player.name} />
          <AvatarFallback className="text-lg">{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{player.name}</h1>
          {stats.matchesPlayed > 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-foreground/80">
              <span>{countLabel(stats.matchesPlayed, MATCH_FORMS)}</span>
              <span className="text-border">·</span>
              <span className="tabular-nums">
                <span className="text-foreground">{stats.wins}</span>–{stats.losses}
              </span>
              <span className="text-border">·</span>
              <span className="tabular-nums">{stats.winPct}% перемог</span>
            </p>
          ) : (
            <p className="text-sm text-foreground/80">
              Ще не {player.gender === "FEMALE" ? "зіграла" : "зіграв"} жодного матчу
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={capitalize(pluralizeUk(stats.matchesPlayed, MATCH_FORMS))} value={stats.matchesPlayed} />
        <StatCard label={capitalize(pluralizeUk(stats.wins, WIN_FORMS))} value={stats.wins} />
        <StatCard label={capitalize(pluralizeUk(stats.losses, LOSS_FORMS))} value={stats.losses} />
        <StatCard label="% перемог" value={`${stats.winPct}%`} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {selectedOpponent ? `Особисті зустрічі: ${selectedOpponent.name}` : "Історія матчів"}
          </h2>
          {opponents.length > 0 && (
            <OpponentFilter opponents={opponents} selectedId={selectedOpponent?.id ?? ""} />
          )}
        </div>

        {selectedOpponent && h2hStats && h2hStats.matchesPlayed > 0 && (
          <p className="text-sm text-foreground/80">
            <span className="tabular-nums">
              <span className="text-foreground">{h2hStats.wins}</span>–{h2hStats.losses}
            </span>{" "}
            ({countLabel(h2hStats.matchesPlayed, MATCH_FORMS)} із визначеним переможцем)
          </p>
        )}

        {visibleMatches.length === 0 && <p className="text-foreground/80">Матчів ще немає.</p>}
        {visibleMatches.map((match) => (
          <MatchSummary key={match.id} match={match} perspectivePlayerId={id} />
        ))}
      </div>
    </div>
  );
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
