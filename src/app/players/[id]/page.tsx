import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getPlayerMatches } from "@/lib/queries/matches";
import { getPlayerById } from "@/lib/queries/players";
import { getPlayerStats } from "@/lib/stats";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) notFound();

  const [stats, matches] = await Promise.all([getPlayerStats(id), getPlayerMatches(id)]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarImage src={player.user?.image ?? undefined} alt={player.name} />
          <AvatarFallback className="text-lg">{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{player.name}</h1>
          <p className="text-sm text-muted-foreground">
            {stats.matchesPlayed > 0
              ? `${stats.matchesPlayed} матчів · ${stats.wins}В–${stats.losses}П · ${stats.winPct}% перемог`
              : "Ще не зіграв(ла) жодного матчу"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Матчів" value={stats.matchesPlayed} />
        <StatCard label="Перемог" value={stats.wins} />
        <StatCard label="Поразок" value={stats.losses} />
        <StatCard label="% перемог" value={`${stats.winPct}%`} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Історія матчів</h2>
        {matches.length === 0 && <p className="text-muted-foreground">Матчів ще немає.</p>}
        {matches.map((match) => (
          <MatchSummary key={match.id} match={match} perspectivePlayerId={id} />
        ))}
      </div>
    </div>
  );
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
