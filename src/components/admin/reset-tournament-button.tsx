"use client";

import { RotateCcwIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

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
import { resetTournamentAction } from "@/lib/actions/tournaments";
import type { ActionState } from "@/lib/actions/tournaments";

const initialState: ActionState = {};

// Same confirm word/reasoning as deleteTournamentAction and the
// rerandomizer's delete-confirmation gate - this wipes recorded scores too.
const DELETE_CONFIRM_WORD = "ВИДАЛИТИ";

function ResetButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={disabled || pending}>
      {pending ? "Обнулення…" : "Обнулити"}
    </Button>
  );
}

export function ResetTournamentButton({
  id,
  name,
  completedMatchCount,
  disabled,
}: {
  id: string;
  name: string;
  completedMatchCount: number;
  /** Nothing to reset yet - no matches and no group assignments. */
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(resetTournamentAction, initialState);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const needsDeleteConfirmation = completedMatchCount > 0;
  const deleteConfirmed = confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  // Unlike deleteTournamentAction (which redirects away on success, so the
  // dialog closing is moot), resetTournamentAction re-renders the same
  // page - the dialog has to be closed explicitly once it succeeds.
  useEffect(() => {
    if (state.success) {
      setOpen(false);
      toast.success("Турнір обнулено");
    }
  }, [state]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        <RotateCcwIcon /> Обнулити турнір
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
            <AlertDialogTitle>Обнулити турнір {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Усі матчі та розподіл учасників по групах будуть видалені назавжди. Самі учасники
              турніру (і їхня сіяність) залишаться — можна буде провести жеребкування заново.
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
              <Label htmlFor="tournament-reset-confirm" className="text-sm">
                Введіть <span className="font-semibold">{DELETE_CONFIRM_WORD}</span>, щоб
                підтвердити
              </Label>
              <Input
                id="tournament-reset-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
          {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <ResetButton disabled={needsDeleteConfirmation && !deleteConfirmed} />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
