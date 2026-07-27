"use client";

import { Loader2Icon, RefreshCwIcon, ShuffleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { commitDoublesMatchesAction, drawDoublesTeamsAction } from "@/lib/actions/matches";
import type { NamedMatchup, NamedPlayer, NamedTeam } from "@/lib/actions/matches";
import { cn } from "@/lib/utils";

type Phase = "intro" | "drawing" | "committing";

type Draw = {
  seededBasket: NamedPlayer[];
  unseededBasket: NamedPlayer[];
  teams: NamedTeam[];
  matchups: NamedMatchup[];
  unpairedNames: string[];
};

const REVEAL_INTERVAL_MS = 5000;

export function RandomizeMatchesButton({
  tournamentId,
  hasSeededPlayer,
  hasMatches,
}: {
  tournamentId: string;
  hasSeededPlayer: boolean;
  hasMatches: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [loadingDraw, setLoadingDraw] = useState(false);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPhase("intro");
      setDraw(null);
      setRevealedCount(0);
    }
  }

  async function startDraw() {
    setLoadingDraw(true);
    const result = await drawDoublesTeamsAction(tournamentId);
    setLoadingDraw(false);
    if (!result.ok) {
      toast.error(result.error);
      setOpen(false);
      return;
    }
    setDraw(result);
    setRevealedCount(0);
    setPhase("drawing");
  }

  // Reveal one pair at a time, then move on to committing once all are shown.
  useEffect(() => {
    if (!open || phase !== "drawing" || !draw) return;
    if (revealedCount >= draw.teams.length) {
      const t = setTimeout(() => setPhase("committing"), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealedCount((c) => c + 1), REVEAL_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [open, phase, draw, revealedCount]);

  // Persist the exact draw that was just animated.
  useEffect(() => {
    if (!open || phase !== "committing" || !draw) return;
    let cancelled = false;
    (async () => {
      const matchups = draw.matchups.map((m) => ({
        sideAIds: m.sideA.playerIds,
        sideBIds: m.sideB.playerIds,
      }));
      const result = await commitDoublesMatchesAction(tournamentId, matchups);
      if (cancelled) return;
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Створено матчів: ${result.matchCount}`);
      }
      setOpen(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, phase, draw, tournamentId]);

  const drawnIds = new Set(draw?.teams.slice(0, revealedCount).flatMap((t) => t.playerIds) ?? []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            disabled={!hasSeededPlayer}
            title={hasSeededPlayer ? undefined : "Позначте хоча б одного гравця як сеяного"}
          />
        }
      >
        {hasMatches ? (
          <>
            <RefreshCwIcon /> Рерандомайзер
          </>
        ) : (
          <>
            <ShuffleIcon /> Рандомайзер
          </>
        )}
      </DialogTrigger>
      <DialogContent
        showCloseButton={phase === "intro"}
        className={phase === "intro" ? undefined : "sm:max-w-md"}
      >
        <DialogHeader>
          <DialogTitle>
            {phase === "intro" &&
              (hasMatches ? "Переграти жеребкування?" : "Випадкова жеребкування пар?")}
            {phase === "drawing" && "Формування пар…"}
            {phase === "committing" && "Створення матчів…"}
          </DialogTitle>
          {phase === "intro" && (
            <DialogDescription>
              Кожна пара формується з одного сеяного та одного несіяного гравця (якщо це можливо).
              Потім кожна пара зіграє з кожною іншою парою (кругова система) — буде створено новий
              матч на кожну комбінацію.
              {hasMatches && (
                <span className="mt-2 block font-medium text-destructive">
                  Усі поточні матчі цього турніру буде видалено та замінено новими.
                </span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {phase === "intro" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={startDraw} disabled={loadingDraw}>
              {loadingDraw ? "Тасування…" : "Почати жеребкування"}
            </Button>
          </DialogFooter>
        )}

        {phase === "drawing" && draw && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Basket title="Сеяні" players={draw.seededBasket} drawnIds={drawnIds} />
              <Basket title="Несіяні" players={draw.unseededBasket} drawnIds={drawnIds} />
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">
                Пар сформовано: {revealedCount} / {draw.teams.length}
              </p>
              {draw.teams.slice(0, revealedCount).map((team) => (
                <div
                  key={team.playerIds.join("+")}
                  className="animate-in fade-in-0 slide-in-from-bottom-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm duration-300"
                >
                  {team.names[0]} / {team.names[1]}
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "committing" && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Створюємо матчі…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Basket({
  title,
  players,
  drawnIds,
}: {
  title: string;
  players: NamedPlayer[];
  drawnIds: Set<string>;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {players.map((player) => (
          <span
            key={player.playerId}
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs transition-all duration-500",
              drawnIds.has(player.playerId)
                ? "scale-95 text-muted-foreground/50 line-through opacity-50"
                : "text-foreground",
            )}
          >
            {player.name}
          </span>
        ))}
      </div>
    </div>
  );
}
