"use client";

import { Trash2Icon } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteTournamentAction } from "@/lib/actions/tournaments";
import type { ActionState } from "@/lib/actions/tournaments";

const initialState: ActionState = {};

// Same confirm word/reasoning as the rerandomizer's delete-confirmation
// gate (randomize-matches-button.tsx): deleting a tournament is a strictly
// bigger version of that same loss - the whole tournament and every result,
// not just the draw - so it gets the same typed-word safeguard.
const DELETE_CONFIRM_WORD = "ВИДАЛИТИ";

function DeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={disabled || pending}>
      {pending ? "Видалення…" : "Видалити"}
    </Button>
  );
}

export function DeleteTournamentButton({
  id,
  name,
  completedMatchCount,
}: {
  id: string;
  name: string;
  completedMatchCount: number;
}) {
  const [state, formAction] = useActionState(deleteTournamentAction, initialState);
  const [confirmText, setConfirmText] = useState("");
  const needsDeleteConfirmation = completedMatchCount > 0;
  const deleteConfirmed = confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  return (
    <AlertDialog onOpenChange={(open) => !open && setConfirmText("")}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Trash2Icon /> Видалити турнір
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <input
            type="hidden"
            name="acknowledgedCompletedLoss"
            value={needsDeleteConfirmation ? String(deleteConfirmed) : "false"}
          />
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити турнір {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Усі матчі та результати цього турніру будуть видалені назавжди.
              {needsDeleteConfirmation && (
                <span className="mt-2 block font-medium text-destructive">
                  У турнірі є {completedMatchCount} завершених матчів із зафіксованим рахунком —
                  вони будуть видалені разом з рештою й не підлягають відновленню.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {needsDeleteConfirmation && (
            <div className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor="tournament-delete-confirm" className="text-sm">
                Введіть <span className="font-semibold">{DELETE_CONFIRM_WORD}</span>, щоб
                підтвердити
              </Label>
              <Input
                id="tournament-delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
          {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <DeleteButton disabled={needsDeleteConfirmation && !deleteConfirmed} />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
