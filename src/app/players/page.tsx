import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getPlayers } from "@/lib/queries/players";
import { getAllPlayerStats } from "@/lib/stats";

export const metadata = { title: "Гравці" };

export default async function PlayersPage() {
  const [players, stats] = await Promise.all([getPlayers(), getAllPlayerStats()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Гравці</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((player) => {
          const playerStats = stats.get(player.id);
          return (
            <Link key={player.id} href={`/players/${player.id}`}>
              <Card className="flex flex-row items-center gap-3 p-4 transition-colors hover:border-primary">
                <Avatar>
                  <AvatarImage src={player.user?.image ?? undefined} alt={player.name} />
                  <AvatarFallback>{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{player.name}</p>
                  {playerStats ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span className="tabular-nums">
                        <span className="text-foreground">{playerStats.wins}</span>–
                        {playerStats.losses}
                      </span>
                      <span className="text-border">·</span>
                      <span className="tabular-nums">{playerStats.winPct}%</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ще без матчів</p>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
        {players.length === 0 && (
          <p className="text-foreground/80">Ще немає жодного гравця клубу.</p>
        )}
      </div>
    </div>
  );
}
