import Link from "next/link";

import { LoadMore } from "@/components/load-more";
import { PageHeroGlow } from "@/components/page-hero-glow";
import { SearchInput } from "@/components/search-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { parseShowParam } from "@/lib/load-more";
import { displayName } from "@/lib/player-display";
import { countLabel, PLAYER_FORMS } from "@/lib/pluralize";
import { getAllPadelPlayerStats } from "@/lib/padel-stats";
import { getPlayersPage } from "@/lib/queries/players";

// Padel twin of /players: only players whose Player.sports includes padel, with padel stats.
// Cards link to the padel-only profile, /padel/players/[id].
export const metadata = { title: "Гравці — Падел" };

const PAGE_SIZE = 20;

function buildShowMoreHref(shown: number, query: string | undefined): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("show", String(shown));
  return `/padel/players?${params.toString()}`;
}

export default async function PadelPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; q?: string }>;
}) {
  const { show: showParam, q: query } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const [{ players, total }, stats] = await Promise.all([
    getPlayersPage(shown, query, "PADEL"),
    getAllPadelPlayerStats(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeroGlow />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Гравці
        </h1>
        <SearchInput placeholder="Пошук гравця…" defaultValue={query} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((player) => {
          const playerStats = stats.get(player.id);
          return (
            <Link key={player.id} href={`/padel/players/${player.id}`}>
              <Card className="flex flex-row items-center gap-3 p-4 transition-colors hover:border-primary">
                <Avatar>
                  <AvatarImage src={player.user?.image ?? undefined} alt={displayName(player)} />
                  <AvatarFallback>{displayName(player).slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{displayName(player)}</p>
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
          <p className="text-foreground/80">
            {query ? `Нічого не знайдено за запитом «${query}».` : "Ще немає жодного гравця падела."}
          </p>
        )}
      </div>
      <LoadMore
        shown={players.length}
        total={total}
        href={buildShowMoreHref(shown + PAGE_SIZE, query)}
        label={`Показано ${players.length} з ${countLabel(total, PLAYER_FORMS)}`}
      />
    </div>
  );
}
