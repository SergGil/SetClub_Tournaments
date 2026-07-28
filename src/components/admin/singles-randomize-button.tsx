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
    const result = await commitSinglesRoundRobinAction(tournamentId);
    setPending(false);
    setOpen(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Створено матчів: ${result.matchCount}`);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={pending}>
            {pending ? "Створення…" : "Створити"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
