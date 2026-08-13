"use client";

import { Loader2Icon, PlusIcon, RefreshCwIcon, ShuffleIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NamedPlayer } from "@/lib/actions/padel-match-randomize-shared";
import {
  commitPadelDoublesGroupsAction,
  commitPadelDoublesMatchesAction,
  drawPadelDoublesGroupsAction,
  drawPadelDoublesTeamsAction,
} from "@/lib/actions/padel-randomize-doubles";
import type { DoublesGroupDrawState, DrawState, NamedGroupedTeam } from "@/lib/actions/padel-randomize-doubles";
import { doublesRandomizeStrategyValues, resolveGroupLabel } from "@/lib/randomize-pairs";
import type { DoublesRandomizeStrategy } from "@/lib/randomize-pairs";
import { cn } from "@/lib/utils";

const DOUBLES_STRATEGY_LABEL: Record<DoublesRandomizeStrategy, string> = {
  ALL: "Усі пари між собою",
  CUSTOM_GROUPS: "За групами",
};

type Phase = "intro" | "drawing" | "committing";

type FlatDraw = Extract<DrawState, { ok: true }>;
type GroupedDraw = Extract<DoublesGroupDrawState, { ok: true }>;
type Draw = FlatDraw | GroupedDraw;

type FixedPairSlot = { a: string; b: string };

const REVEAL_INTERVAL_MS = 3500;

const DELETE_CONFIRM_WORD = "ВИДАЛИТИ";

/** Padel twin of randomize-matches-button.tsx. */
export function PadelRandomizeMatchesButton({
  tournamentId,
  roster,
  hasSeededPlayer,
  groupCounts,
  customGroupNames,
  hasMatches,
  completedMatchCount,
}: {
  tournamentId: string;
  roster: { id: string; name: string }[];
  hasSeededPlayer: boolean;
  groupCounts: Record<number, number>;
  customGroupNames: Map<number, string>;
  hasMatches: boolean;
  completedMatchCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [strategy, setStrategy] = useState<DoublesRandomizeStrategy>("ALL");
  const [loadingDraw, setLoadingDraw] = useState(false);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [fixedPairSlots, setFixedPairSlots] = useState<FixedPairSlot[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const committedRef = useRef(false);

  const canSplitByGroup = Object.keys(groupCounts).length > 0;
  const takenIds = new Set(fixedPairSlots.flatMap((s) => [s.a, s.b]).filter(Boolean));
  const availableCount = roster.length - takenIds.size;
  const hasIncompleteFixedPair = fixedPairSlots.some((s) => Boolean(s.a) !== Boolean(s.b));
  const needsDeleteConfirmation = completedMatchCount > 0;
  const deleteConfirmed = confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  function handleOpenChange(next: boolean) {
    if (!next && (phase === "drawing" || phase === "committing")) return;
    setOpen(next);
    if (next) {
      setPhase("intro");
      setStrategy("ALL");
      setDraw(null);
      setRevealedCount(0);
      setFixedPairSlots([]);
      setConfirmText("");
      committedRef.current = false;
    }
  }

  async function startDraw() {
    const fixedPairs = fixedPairSlots
      .filter((s) => s.a && s.b)
      .map((s): [string, string] => [s.a, s.b]);

    setLoadingDraw(true);
    const result =
      strategy === "CUSTOM_GROUPS"
        ? await drawPadelDoublesGroupsAction(tournamentId, fixedPairs)
        : await drawPadelDoublesTeamsAction(tournamentId, fixedPairs);
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

  useEffect(() => {
    if (!open || phase !== "drawing" || !draw) return;
    if (revealedCount >= draw.randomTeams.length) {
      const t = setTimeout(() => setPhase("committing"), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealedCount((c) => c + 1), REVEAL_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [open, phase, draw, revealedCount]);

  useEffect(() => {
    if (!open || phase !== "committing" || !draw) return;
    if (committedRef.current) return;
    committedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const result =
          "groups" in draw
            ? await commitPadelDoublesGroupsAction(
                tournamentId,
                draw.groupAssignment,
                draw.matchups.map((m) => ({
                  sideAIds: m.sideA.playerIds,
                  sideBIds: m.sideB.playerIds,
                  group: m.group,
                })),
                needsDeleteConfirmation,
              )
            : await commitPadelDoublesMatchesAction(
                tournamentId,
                draw.matchups.map((m) => ({ sideAIds: m.sideA.playerIds, sideBIds: m.sideB.playerIds })),
                needsDeleteConfirmation,
              );
        if (cancelled) return;
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(`Створено матчів: ${result.matchCount}`);
        }
      } catch {
        if (!cancelled) toast.error("Не вдалося створити матчі");
      } finally {
        if (!cancelled) setOpen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, phase, draw, tournamentId, needsDeleteConfirmation]);

  const drawnIds = new Set(draw?.randomTeams.slice(0, revealedCount).flatMap((t) => t.playerIds) ?? []);

  function updateSlot(index: number, next: FixedPairSlot) {
    setFixedPairSlots((prev) => prev.map((s, i) => (i === index ? next : s)));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            disabled={!hasSeededPlayer}
            title={hasSeededPlayer ? undefined : "Позначте хоча б одного гравця як сіяного"}
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
        className="sm:max-w-md"
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
              {strategy === "CUSTOM_GROUPS"
                ? "Кожна група сформує пари (сіяний + несіяний, де можливо) і зіграє круговою системою лише всередині себе — команди з різних груп між собою не зустрічаються."
                : "Кожна пара формується з одного сіяного та одного несіяного гравця (якщо це можливо). Потім кожна пара зіграє з кожною іншою парою (кругова система) — буде створено новий матч на кожну комбінацію."}
              {hasMatches && !needsDeleteConfirmation && (
                <span className="mt-2 block font-medium text-destructive">
                  Усі поточні матчі цього турніру буде видалено та замінено новими.
                </span>
              )}
              {needsDeleteConfirmation && (
                <span className="mt-2 block font-medium text-destructive">
                  У турнірі вже є {completedMatchCount} завершених матчів із зафіксованим
                  рахунком — вони будуть видалені разом з рештою й не підлягають відновленню.
                </span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {phase === "intro" && needsDeleteConfirmation && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="padel-randomize-delete-confirm" className="text-sm">
              Введіть <span className="font-semibold">{DELETE_CONFIRM_WORD}</span>, щоб
              підтвердити
            </Label>
            <Input
              id="padel-randomize-delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        {phase === "intro" && canSplitByGroup && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="padel-doubles-randomize-strategy">Логіка формування пар</Label>
            <Select
              items={DOUBLES_STRATEGY_LABEL}
              value={strategy}
              onValueChange={(value) => value && setStrategy(value as DoublesRandomizeStrategy)}
            >
              <SelectTrigger id="padel-doubles-randomize-strategy" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {doublesRandomizeStrategyValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {DOUBLES_STRATEGY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {phase === "intro" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Заздалегідь визначені пари (опційно)</p>
            {fixedPairSlots.length > 0 && (
              <div className="flex flex-col gap-2">
                {fixedPairSlots.map((slot, index) => (
                  <FixedPairRow
                    key={index}
                    roster={roster}
                    value={slot}
                    takenIds={takenIds}
                    onChange={(next) => updateSlot(index, next)}
                    onRemove={() =>
                      setFixedPairSlots((prev) => prev.filter((_, i) => i !== index))
                    }
                  />
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={availableCount < 2}
              onClick={() => setFixedPairSlots((prev) => [...prev, { a: "", b: "" }])}
            >
              <PlusIcon /> Додати пару
            </Button>
            <p className="text-xs text-muted-foreground">
              Решта учасників розподіляються між собою повністю випадково, як і зазвичай.
            </p>
          </div>
        )}

        {phase === "intro" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button
              onClick={startDraw}
              disabled={
                loadingDraw ||
                hasIncompleteFixedPair ||
                (needsDeleteConfirmation && !deleteConfirmed)
              }
            >
              {loadingDraw ? "Тасування…" : "Почати жеребкування"}
            </Button>
          </DialogFooter>
        )}

        {phase === "drawing" && draw && "groups" in draw && (
          <div className="flex flex-col gap-4">
            <div
              className={cn(
                "grid grid-cols-1 gap-3",
                draw.groups.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2",
              )}
            >
              {draw.groups.map((g) => (
                <GroupTeamsCard
                  key={g}
                  title={resolveGroupLabel(g, customGroupNames)}
                  fixedTeams={draw.fixedTeams.filter((t) => t.group === g)}
                  revealedTeams={draw.randomTeams.slice(0, revealedCount).filter((t) => t.group === g)}
                />
              ))}
            </div>

            {draw.unpairedNames.length > 0 && (
              <p className="text-sm text-destructive">
                Без пари (непарна кількість учасників): {draw.unpairedNames.join(", ")}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Пар сформовано: {revealedCount} / {draw.randomTeams.length}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRevealedCount(draw.randomTeams.length)}
              >
                Пропустити
              </Button>
            </div>
          </div>
        )}

        {phase === "drawing" && draw && !("groups" in draw) && (
          <div className="flex flex-col gap-4">
            {draw.fixedTeams.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">Заздалегідь визначені пари</p>
                {draw.fixedTeams.map((team) => (
                  <div
                    key={team.playerIds.join("+")}
                    className="rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm"
                  >
                    {team.names[0]} / {team.names[1]}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Basket title="Сіяні" players={draw.seededBasket} drawnIds={drawnIds} />
              <Basket title="Несіяні" players={draw.unseededBasket} drawnIds={drawnIds} />
            </div>

            {draw.unpairedNames.length > 0 && (
              <p className="text-sm text-destructive">
                Без пари (непарна кількість учасників): {draw.unpairedNames.join(", ")}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Пар сформовано: {revealedCount} / {draw.randomTeams.length}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevealedCount(draw.randomTeams.length)}
                >
                  Пропустити
                </Button>
              </div>
              {draw.randomTeams.slice(0, revealedCount).map((team) => (
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

function FixedPairRow({
  roster,
  value,
  takenIds,
  onChange,
  onRemove,
}: {
  roster: { id: string; name: string }[];
  value: FixedPairSlot;
  takenIds: Set<string>;
  onChange: (next: FixedPairSlot) => void;
  onRemove: () => void;
}) {
  function optionsFor(current: string) {
    return roster.filter((p) => p.id === current || !takenIds.has(p.id));
  }

  const aOptions = optionsFor(value.a);
  const bOptions = optionsFor(value.b);

  return (
    <div className="flex items-center gap-2">
      <Select
        items={Object.fromEntries(aOptions.map((p) => [p.id, p.name]))}
        value={value.a}
        onValueChange={(next) => onChange({ ...value, a: next ?? "" })}
      >
        <SelectTrigger className="w-full min-w-0" aria-label="Гравець 1">
          <SelectValue placeholder="Гравець 1" />
        </SelectTrigger>
        <SelectContent>
          {aOptions.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">+</span>
      <Select
        items={Object.fromEntries(bOptions.map((p) => [p.id, p.name]))}
        value={value.b}
        onValueChange={(next) => onChange({ ...value, b: next ?? "" })}
      >
        <SelectTrigger className="w-full min-w-0" aria-label="Гравець 2">
          <SelectValue placeholder="Гравець 2" />
        </SelectTrigger>
        <SelectContent>
          {bOptions.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}>
        <XIcon />
        <span className="sr-only">Прибрати пару</span>
      </Button>
    </div>
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

function GroupTeamsCard({
  title,
  fixedTeams,
  revealedTeams,
}: {
  title: string;
  fixedTeams: NamedGroupedTeam[];
  revealedTeams: NamedGroupedTeam[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-1.5">
        {fixedTeams.map((team) => (
          <div
            key={team.playerIds.join("+")}
            className="rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm"
          >
            {team.names[0]} / {team.names[1]}
          </div>
        ))}
        {revealedTeams.map((team) => (
          <div
            key={team.playerIds.join("+")}
            className="animate-in fade-in-0 slide-in-from-bottom-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm duration-300"
          >
            {team.names[0]} / {team.names[1]}
          </div>
        ))}
      </div>
    </div>
  );
}
