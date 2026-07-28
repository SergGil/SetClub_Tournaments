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
import { commitSinglesRoundRobinAction } from "@/lib/actions/matches";

export function SinglesRandomizeButton({
  tournamentId,
  participantCount,
  hasMatches,
}: {
  tournamentId: string;
  participantCount: number;
  hasMatches: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const matchCount = (participantCount * (participantCount - 1)) / 2;

  async function handleConfirm() {
    setPending(true);
    try {
      const result = await commitSinglesRoundRobinAction(tournamentId);
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
          <AlertDialogDescription>
            Кожен учасник зіграє з кожним іншим по одному разу — буде створено {matchCount}{" "}
            матчів.
            {hasMatches && (
              <span className="mt-2 block font-medium text-destructive">
                Усі поточні матчі цього турніру буде видалено та замінено новими.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={pending}>
            {pending ? "Створення…" : "Створити"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
