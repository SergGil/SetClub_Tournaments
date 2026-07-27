"use client";

import { ShuffleIcon } from "lucide-react";
import { useTransition } from "react";
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
import { randomizePairsAction } from "@/lib/actions/matches";

export function RandomizeMatchesButton({
  tournamentId,
  hasSeededPlayer,
}: {
  tournamentId: string;
  hasSeededPlayer: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await randomizePairsAction(tournamentId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const unpairedNote =
        result.unpairedCount && result.unpairedCount > 0
          ? ` (${result.unpairedCount} гравець без пари)`
          : "";
      toast.success(`Створено матчів: ${result.matchCount}${unpairedNote}`);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            disabled={pending || !hasSeededPlayer}
            title={hasSeededPlayer ? undefined : "Позначте хоча б одного гравця як сеяного"}
          />
        }
      >
        <ShuffleIcon /> Рандомайзер
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Випадкова жеребкування пар?</AlertDialogTitle>
          <AlertDialogDescription>
            Кожна пара формується з одного сеяного та одного несіяного гравця (якщо це можливо).
            Потім кожна пара зіграє з кожною іншою парою (кругова система) — буде створено новий
            матч на кожну комбінацію. Вже існуючі матчі не змінюються.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={run}>Створити пари</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
