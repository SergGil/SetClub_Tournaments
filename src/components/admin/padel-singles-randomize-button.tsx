"use client";

import { Loader2Icon, RefreshCwIcon, ShuffleIcon } from "lucide-react";
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
  commitPadelSinglesGroupsAction,
  commitPadelSinglesRoundRobinAction,
  drawPadelSinglesGroupsAction,
} from "@/lib/actions/padel-randomize-singles";
import type { SinglesGroupDrawState } from "@/lib/actions/padel-randomize-singles";
import {
  commitPadelGroups12PlayoffAction,
  drawPadelGroups12PlayoffAction,
} from "@/lib/actions/padel-randomize-singles-groups12";
import type { Groups12PlayoffDrawState } from "@/lib/actions/padel-randomize-singles-groups12";
import { resolveGroupLabel, singlesRandomizeStrategyValues } from "@/lib/randomize-pairs";
import type { SinglesRandomizeStrategy } from "@/lib/randomize-pairs";
import { cn } from "@/lib/utils";

const STRATEGY_LABEL: Record<SinglesRandomizeStrategy, string> = {
  ALL: "Усі проти всіх",
  SEEDED_SPLIT: "Сіяні проти сіяних, несіяні проти несіяних",
  CUSTOM_GROUPS: "За групами",
  GROUPS_12_PLAYOFF: "4 групи по 3 + плей-офф (12 учасників, 4 сіяних)",
};

const REVEAL_INTERVAL_MS = 1500;

const DELETE_CONFIRM_WORD = "ВИДАЛИТИ";

function pairs(n: number): number {
  return (n * (n - 1)) / 2;
}

function projectedGroupSizes(groupCounts: Record<number, number>, unassignedCount: number): number[] {
  const sizes = Object.values(groupCounts);
  if (sizes.length === 0) return [];
  const base = Math.floor(unassignedCount / sizes.length);
  const remainder = unassignedCount % sizes.length;
  return sizes.map((size, i) => size + base + (i < remainder ? 1 : 0));
}

function matchCountFor(
  strategy: SinglesRandomizeStrategy,
  seededCount: number,
  unseededCount: number,
  groupCounts: Record<number, number>,
  unassignedCount: number,
): number {
  if (strategy === "SEEDED_SPLIT") return pairs(seededCount) + pairs(unseededCount);
  if (strategy === "CUSTOM_GROUPS") {
    return projectedGroupSizes(groupCounts, unassignedCount).reduce((sum, size) => sum + pairs(size), 0);
  }
  if (strategy === "GROUPS_12_PLAYOFF") return 30;
  return pairs(seededCount + unseededCount);
}

type Draw = Extract<SinglesGroupDrawState, { ok: true }> | Extract<Groups12PlayoffDrawState, { ok: true }>;
type Phase = "intro" | "drawing" | "committing";

/** Padel twin of singles-randomize-button.tsx. */
export function PadelSinglesRandomizeButton({
  tournamentId,
  seededCount,
  unseededCount,
  groupCounts,
  customGroupNames,
  hasMatches,
  completedMatchCount,
}: {
  tournamentId: string;
  seededCount: number;
  unseededCount: number;
  groupCounts: Record<number, number>;
  customGroupNames: Map<number, string>;
  hasMatches: boolean;
  completedMatchCount: number;
}) {
  const participantCount = seededCount + unseededCount;
  const canSplitBySeed = seededCount > 0;
  const canSplitByGroup = Object.keys(groupCounts).length > 0;
  const canGroups12Playoff = participantCount === 12 && seededCount === 4;
  const groupedCount = Object.values(groupCounts).reduce((sum, count) => sum + count, 0);
  const unassignedCount = participantCount - groupedCount;

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [pending, setPending] = useState(false);
  const [strategy, setStrategy] = useState<SinglesRandomizeStrategy>("ALL");
  const [draw, setDraw] = useState<Draw | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [confirmText, setConfirmText] = useState("");
  const committedRef = useRef(false);

  const matchCount = matchCountFor(strategy, seededCount, unseededCount, groupCounts, unassignedCount);
  const needsDeleteConfirmation = completedMatchCount > 0;
  const deleteConfirmed = confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  function handleOpenChange(next: boolean) {
    if (!next && (phase === "drawing" || phase === "committing")) return;
    setOpen(next);
    if (next) {
      setPhase("intro");
      setStrategy("ALL");
      setConfirmText("");
      setDraw(null);
      setRevealedCount(0);
      committedRef.current = false;
    }
  }

  async function handleConfirm() {
    if (strategy === "CUSTOM_GROUPS" || strategy === "GROUPS_12_PLAYOFF") {
      setPending(true);
      const result =
        strategy === "GROUPS_12_PLAYOFF"
          ? await drawPadelGroups12PlayoffAction(tournamentId)
          : await drawPadelSinglesGroupsAction(tournamentId);
      setPending(false);
      if (!result.ok) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      setDraw(result);
      setRevealedCount(0);
      setPhase("drawing");
      return;
    }

    setPending(true);
    try {
      const result = await commitPadelSinglesRoundRobinAction(tournamentId, strategy, needsDeleteConfirmation);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Створено матчів: ${result.matchCount}`);
      }
    } catch {
      toast.error("Не вдалося створити матчі");
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open || phase !== "drawing" || !draw) return;
    if (revealedCount >= draw.revealOrder.length) {
      const t = setTimeout(() => setPhase("committing"), 1000);
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
        const commit =
          strategy === "GROUPS_12_PLAYOFF" ? commitPadelGroups12PlayoffAction : commitPadelSinglesGroupsAction;
        const result = await commit(
          tournamentId,
          draw.groupAssignment,
          draw.matchups.map((m) => ({ sideA: m.sideA.playerId, sideB: m.sideB.playerId, round: m.round })),
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
  }, [open, phase, draw, strategy, tournamentId, needsDeleteConfirmation]);

  const revealedPlayers = draw?.revealOrder.slice(0, revealedCount) ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            disabled={participantCount < 2}
            title={participantCount < 2 ? "Потрібно щонайменше 2 учасники" : undefined}
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
        className={phase === "intro" ? undefined : "sm:max-w-lg"}
      >
        <DialogHeader>
          <DialogTitle>
            {phase === "intro" &&
              (hasMatches ? "Переграти кругову систему?" : "Створити кругову систему?")}
            {phase === "drawing" && "Розподіл по групах…"}
            {phase === "committing" && "Створення матчів…"}
          </DialogTitle>
          {phase === "intro" && (
            <DialogDescription>Оберіть, за якою логікою сформувати матчі.</DialogDescription>
          )}
        </DialogHeader>

        {phase === "intro" && (
          <div className="flex flex-col gap-3 text-sm">
            {(canSplitBySeed || canSplitByGroup || canGroups12Playoff) && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="padel-singles-randomize-strategy">Логіка формування матчів</Label>
                <Select
                  items={STRATEGY_LABEL}
                  value={strategy}
                  onValueChange={(value) => value && setStrategy(value as SinglesRandomizeStrategy)}
                >
                  <SelectTrigger id="padel-singles-randomize-strategy" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {singlesRandomizeStrategyValues
                      .filter(
                        (value) =>
                          value === "ALL" ||
                          (value === "SEEDED_SPLIT" && canSplitBySeed) ||
                          (value === "CUSTOM_GROUPS" && canSplitByGroup) ||
                          (value === "GROUPS_12_PLAYOFF" && canGroups12Playoff),
                      )
                      .map((value) => (
                        <SelectItem key={value} value={value}>
                          {STRATEGY_LABEL[value]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-muted-foreground">
              {strategy === "SEEDED_SPLIT" &&
                `Сіяні (${seededCount}) зіграють між собою, несіяні (${unseededCount}) — між собою; сіяні й несіяні один з одним не зустрічаються — буде створено ${matchCount} матчів.`}
              {strategy === "CUSTOM_GROUPS" &&
                (unassignedCount > 0
                  ? `${groupedCount} учасників уже розподілені по ${Object.keys(groupCounts).length} групах; решту (${unassignedCount}) буде випадково й порівну домішано до цих самих груп. Кожна група зіграє круговою системою лише всередині себе — буде створено ${matchCount} матчів.`
                  : `Кожна група (${Object.keys(groupCounts).length}, разом ${groupedCount} учасників) зіграє круговою системою лише всередині себе — буде створено ${matchCount} матчів.`)}
              {strategy === "GROUPS_12_PLAYOFF" &&
                "4 групи по 3 гравці (по 1 сіяному в кожній), топ-2 виходять у плей-офф на 1-4 місце з плейдауном на 5-8, треті місця груп грають міні-групу за 9-12 місце. Усі матчі сітки створюються одразу й заповнюються автоматично по мірі завершення попередніх — буде створено 30 матчів."}
              {strategy === "ALL" &&
                `Кожен учасник зіграє з кожним іншим по одному разу — буде створено ${matchCount} матчів.`}
            </p>

            {matchCount === 0 && (
              <p className="font-medium text-destructive">
                За такого розподілу учасників жоден матч не сформується.
              </p>
            )}
            {hasMatches && !needsDeleteConfirmation && (
              <p className="font-medium text-destructive">
                Усі поточні матчі цього турніру буде видалено та замінено новими.
              </p>
            )}
            {needsDeleteConfirmation && (
              <p className="font-medium text-destructive">
                У турнірі вже є {completedMatchCount} завершених матчів із зафіксованим рахунком
                — вони будуть видалені разом з рештою й не підлягають відновленню.
              </p>
            )}
            {needsDeleteConfirmation && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="padel-singles-randomize-delete-confirm">
                  Введіть <span className="font-semibold">{DELETE_CONFIRM_WORD}</span>, щоб
                  підтвердити
                </Label>
                <Input
                  id="padel-singles-randomize-delete-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
        )}

        {phase === "drawing" && draw && (
          <div className="flex flex-col gap-4">
            <div
              className={cn(
                "grid grid-cols-1 gap-3",
                draw.existingGroups.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2",
              )}
            >
              {draw.existingGroups.map((g) => (
                <GroupBasket
                  key={g.group}
                  title={resolveGroupLabel(g.group, customGroupNames)}
                  existingPlayers={g.players}
                  revealedPlayers={revealedPlayers.filter(
                    (p) => draw.groupAssignment[p.playerId] === g.group,
                  )}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Розподілено гравців: {revealedCount} / {draw.revealOrder.length}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRevealedCount(draw.revealOrder.length)}
              >
                Пропустити
              </Button>
            </div>
          </div>
        )}

        {phase === "committing" && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Створюємо матчі…
          </div>
        )}

        {phase === "intro" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                pending || matchCount === 0 || (needsDeleteConfirmation && !deleteConfirmed)
              }
            >
              {pending ? "Завантаження…" : "Створити"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupBasket({
  title,
  existingPlayers,
  revealedPlayers,
}: {
  title: string;
  existingPlayers: NamedPlayer[];
  revealedPlayers: NamedPlayer[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {existingPlayers.map((player) => (
          <span key={player.playerId} className="rounded-full border px-2 py-0.5 text-xs text-foreground">
            {player.name}
          </span>
        ))}
        {revealedPlayers.map((player) => (
          <span
            key={player.playerId}
            className="animate-in fade-in-0 zoom-in-95 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-foreground duration-300"
          >
            {player.name}
          </span>
        ))}
      </div>
    </div>
  );
}
