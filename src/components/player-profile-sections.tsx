import Link from "next/link";

import { OpponentFilter } from "@/components/opponent-filter";
import { PillFilterGroup, PillFilterLink } from "@/components/pill-filter";
import { StatCard } from "@/components/stat-card";
import { TournamentFilter } from "@/components/tournament-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { displayName, fullDisplayName } from "@/lib/player-display";
import type { ProfileView } from "@/lib/player-profile";
import type { PlayerStats } from "@/lib/player-stats";
import { countLabel, LOSS_FORMS, MATCH_FORMS, pluralizeUk, WIN_FORMS } from "@/lib/pluralize";
import { cn } from "@/lib/utils";

/**
 * The player-profile page body shared by the Tennis (/players/[id]) and Padel
 * (/padel/players/[id]) profiles - header, stat tiles and the filtered match
 * history (with the head-to-head card). Each page keeps only what's specific to
 * its sport: the rating blocks, achievements, best partner and how a single
 * match is rendered.
 */

type ProfilePlayer = {
  name: string;
  nickname: string | null;
  user: { image: string | null } | null;
};

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function PlayerProfileHeader({
  player,
  stats,
  backHref,
  backLabel,
  noMatchesLabel,
}: {
  player: ProfilePlayer;
  stats: PlayerStats;
  backHref: string;
  backLabel: string;
  noMatchesLabel: string;
}) {
  return (
    <>
      <Link href={backHref} className="text-sm text-foreground/80 hover:text-foreground">
        {backLabel}
      </Link>
      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarImage src={player.user?.image ?? undefined} alt={player.name} />
          <AvatarFallback className="text-lg">{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {fullDisplayName(player)}
          </h1>
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
            <p className="text-sm text-foreground/80">{noMatchesLabel}</p>
          )}
        </div>
      </div>
    </>
  );
}

/** Matches / wins / losses (the latter two toggle the result filter) / win-rate tiles. */
export function PlayerStatCards({
  stats,
  view,
}: {
  stats: PlayerStats;
  view: Pick<ProfileView, "profileHref" | "selectedResult">;
}) {
  const { profileHref, selectedResult } = view;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label={capitalize(pluralizeUk(stats.matchesPlayed, MATCH_FORMS))}
        value={stats.matchesPlayed}
        href={profileHref({ result: undefined, type: undefined, year: undefined })}
      />
      <StatCard
        label={capitalize(pluralizeUk(stats.wins, WIN_FORMS))}
        value={stats.wins}
        tone="positive"
        href={profileHref({ result: selectedResult === "win" ? undefined : "win" })}
        active={selectedResult === "win"}
      />
      <StatCard
        label={capitalize(pluralizeUk(stats.losses, LOSS_FORMS))}
        value={stats.losses}
        tone="negative"
        href={profileHref({ result: selectedResult === "loss" ? undefined : "loss" })}
        active={selectedResult === "loss"}
      />
      <StatCard label="% перемог" value={`${stats.winPct}%`} barPct={stats.winPct} />
    </div>
  );
}

/**
 * Match history with its tournament/opponent filters, the head-to-head card, the
 * format/year pills (once a result is selected) and the empty state. `children`
 * is the already-rendered list of visible matches - the only sport-specific part
 * (MatchSummary with the right `sport` and rank maps).
 */
export function PlayerMatchHistory({
  player,
  view,
  visibleCount,
  children,
}: {
  player: ProfilePlayer;
  view: Omit<ProfileView, "visibleMatches">;
  visibleCount: number;
  children: React.ReactNode;
}) {
  const {
    opponents,
    tournaments,
    selectedOpponent,
    selectedTournament,
    selectedResult,
    selectedType,
    activeYear,
    resultYears,
    h2hStats,
    recentH2HResults,
    profileHref,
  } = view;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {selectedOpponent
            ? `Особисті зустрічі: ${selectedOpponent.name}`
            : selectedTournament
              ? selectedTournament.name
              : "Історія матчів"}
          {selectedResult && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({selectedResult === "win" ? "лише перемоги" : "лише поразки"})
            </span>
          )}
        </h2>
        {(tournaments.length > 0 || opponents.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {tournaments.length > 0 && (
              <TournamentFilter
                tournaments={tournaments}
                selectedId={selectedTournament?.id ?? ""}
                opponent={selectedOpponent?.id}
                result={selectedResult}
                type={selectedType}
                year={activeYear}
              />
            )}
            {opponents.length > 0 && (
              <OpponentFilter
                opponents={opponents}
                selectedId={selectedOpponent?.id ?? ""}
                tournament={selectedTournament?.id}
                result={selectedResult}
                type={selectedType}
                year={activeYear}
              />
            )}
          </div>
        )}
      </div>

      {selectedOpponent && h2hStats && h2hStats.matchesPlayed > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-center gap-5 p-4 sm:gap-8">
            <div className="flex flex-col items-center gap-1.5">
              <Avatar className="size-12">
                <AvatarImage src={player.user?.image ?? undefined} alt={player.name} />
                <AvatarFallback>{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="max-w-24 text-center text-sm font-medium text-balance">{displayName(player)}</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <p
                className="flex items-baseline gap-2 text-3xl font-extrabold tabular-nums"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="text-primary">{h2hStats.wins}</span>
                <span className="text-xl font-normal text-muted-foreground">–</span>
                <span>{h2hStats.losses}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {countLabel(h2hStats.matchesPlayed, MATCH_FORMS)} із визначеним переможцем
              </p>
              {recentH2HResults.length > 1 && (
                <div className="mt-0.5 flex items-center gap-1" title="Останні зустрічі (зліва — новіші)">
                  {recentH2HResults.map((result, i) => (
                    <span
                      key={i}
                      className={cn("size-2 rounded-full", result === "win" ? "bg-primary" : "bg-destructive")}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Avatar className="size-12">
                <AvatarImage src={selectedOpponent.image ?? undefined} alt={selectedOpponent.name} />
                <AvatarFallback>{selectedOpponent.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="max-w-24 text-center text-sm font-medium text-balance">{selectedOpponent.name}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Format/year narrowing only makes sense once the list is already scoped to just wins or
          losses - browsing the full history doesn't need it, and offering it there would just
          add clutter. */}
      {selectedResult && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Формат:</span>
            <PillFilterGroup>
              <PillFilterLink href={profileHref({ type: undefined })} active={!selectedType}>
                Усі
              </PillFilterLink>
              <PillFilterLink href={profileHref({ type: "SINGLES" })} active={selectedType === "SINGLES"}>
                Одиночні
              </PillFilterLink>
              <PillFilterLink href={profileHref({ type: "DOUBLES" })} active={selectedType === "DOUBLES"}>
                Парні
              </PillFilterLink>
            </PillFilterGroup>
          </div>
          {resultYears.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Рік:</span>
              <PillFilterGroup>
                <PillFilterLink href={profileHref({ year: undefined })} active={!activeYear}>
                  Усі роки
                </PillFilterLink>
                {resultYears.map((y) => (
                  <PillFilterLink
                    key={y}
                    href={profileHref({ year: y })}
                    active={activeYear === y}
                    className="tabular-nums"
                  >
                    {y}
                  </PillFilterLink>
                ))}
              </PillFilterGroup>
            </div>
          )}
        </div>
      )}

      {visibleCount === 0 && (
        <p className="text-foreground/80">
          {selectedResult === "win" && "Перемог ще немає."}
          {selectedResult === "loss" && "Поразок ще немає."}
          {!selectedResult && "Матчів ще немає."}
        </p>
      )}
      {children}
    </div>
  );
}
