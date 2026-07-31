"use client";

import { RefreshCwIcon, ShuffleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { commitSinglesRoundRobinAction } from "@/lib/actions/matches";
import { singlesRandomizeStrategyValues } from "@/lib/randomize-pairs";
import type { SinglesRandomizeStrategy } from "@/lib/randomize-pairs";

const STRATEGY_LABEL: Record<SinglesRandomizeStrategy, string> = {
  ALL: "Усі проти всіх",
  SEEDED_SPLIT: "Сіяні проти сіяних, несіяні проти несіяних",
};

function pairs(n: number): number {
  return (n * (n - 1)) / 2;
}

function matchCountFor(
  strategy: SinglesRandomizeStrategy,
  seededCount: number,
  unseededCount: number,
): number {
  return strategy === "SEEDED_SPLIT"
    ? pairs(seededCount) + pairs(unseededCount)
    : pairs(seededCount + unseededCount);
}

export function SinglesRandomizeButton({
  tournamentId,
  seededCount,
  unseededCount,
  hasMatches,
}: {
  tournamentId: string;
  seededCount: number;
  unseededCount: number;
  hasMatches: boolean;
}) {
  const participantCount = seededCount + unseededCount;
  const canSplitBySeed = seededCount > 0;

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [strategy, setStrategy] = useState<SinglesRandomizeStrategy>("ALL");

  const matchCount = matchCountFor(strategy, seededCount, unseededCount);

  async function handleConfirm() {
    setPending(true);
    try {
      const result = await commitSinglesRoundRobinAction(tournamentId, strategy);
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

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Mutation can't be aborted once started - ignore Escape/overlay
        // dismissal while it's in flight so its outcome isn't hidden.
        if (!next && pending) return;
        setOpen(next);
        if (next) setStrategy("ALL");
      }}
    >
      <AlertDialogTrigger
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
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasMatches ? "Переграти кругову систему?" : "Створити кругову систему?"}
          </AlertDialogTitle>
          <AlertDialogDescription>Оберіть, за якою логікою сформувати матчі.</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          {canSplitBySeed && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="singles-randomize-strategy">Логіка формування матчів</Label>
              <Select
                items={STRATEGY_LABEL}
                value={strategy}
                onValueChange={(value) => value && setStrategy(value as SinglesRandomizeStrategy)}
              >
                <SelectTrigger id="singles-randomize-strategy" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {singlesRandomizeStrategyValues.map((value) => (
                    <SelectItem key={value} value={value}>
                      {STRATEGY_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-muted-foreground">
            {strategy === "SEEDED_SPLIT"
              ? `Сіяні (${seededCount}) зіграють між собою, несіяні (${unseededCount}) — між собою; сіяні й несіяні один з одним не зустрічаються — буде створено ${matchCount} матчів.`
              : `Кожен учасник зіграє з кожним іншим по одному разу — буде створено ${matchCount} матчів.`}
          </p>

          {matchCount === 0 && (
            <p className="font-medium text-destructive">
              За такого розподілу учасників жоден матч не сформується.
            </p>
          )}
          {hasMatches && (
            <p className="font-medium text-destructive">
              Усі поточні матчі цього турніру буде видалено та замінено новими.
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={pending || matchCount === 0}>
            {pending ? "Створення…" : "Створити"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
