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
import { deletePadelMatchAction } from "@/lib/actions/padel-matches";
import type { ActionState } from "@/lib/actions/padel-matches";

const initialState: ActionState = {};

const CASCADE_CONFIRM_WORD = "СКИНУТИ";

function DeleteButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending || disabled}>
      {pending ? "Видалення…" : "Видалити"}
    </Button>
  );
}

/** Padel twin of delete-match-button.tsx. */
export function DeletePadelMatchButton({ matchId }: { matchId: string }) {
  const [open, setOpen] = useState(false);
  const [cascadeConfirmText, setCascadeConfirmText] = useState("");
  const [state, formAction] = useActionState(deletePadelMatchAction, initialState);
  const cascadeResets = state.cascadeResets ?? [];
  const cascadeConfirmed = cascadeConfirmText.trim().toUpperCase() === CASCADE_CONFIRM_WORD;
  const [handledState, setHandledState] = useState(state);
  if (state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setCascadeConfirmText("");
      }}
    >
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2Icon />
        <span className="sr-only">Видалити матч</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="acknowledgedCascadeReset" value={cascadeConfirmed ? "true" : "false"} />
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити матч?</AlertDialogTitle>
            <AlertDialogDescription>Цю дію не можна скасувати.</AlertDialogDescription>
          </AlertDialogHeader>
          {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
          {cascadeResets.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Видалення скине рахунок наступних матчів:</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {cascadeResets.map((r) => (
                  <li key={r.matchId}>
                    {r.round ? `${r.round}: ` : ""}
                    {r.sideALabel} – {r.sideBLabel}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${matchId}-delete-cascade-confirm`}>
                  Введіть <span className="font-semibold">{CASCADE_CONFIRM_WORD}</span>, щоб підтвердити
                </Label>
                <Input
                  id={`${matchId}-delete-cascade-confirm`}
                  value={cascadeConfirmText}
                  onChange={(e) => setCascadeConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <DeleteButton disabled={cascadeResets.length > 0 && !cascadeConfirmed} />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
