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

export function RandomizeMatchesButton({ tournamentId }: { tournamentId: string }) {
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
      <AlertDialogTrigger render={<Button variant="outline" disabled={pending} />}>
        <ShuffleIcon /> Рандомайзер
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Випадкова жеребкування пар?</AlertDialogTitle>
          <AlertDialogDescription>
            Кожна пара формується з одного сеяного та одного несіяного гравця (якщо це можливо),
            після чого пари випадково розподіляються по матчах. Створить нові матчі — вже
            існуючі не змінюються.
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
