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
import { deleteMenuSectionAction } from "@/lib/actions/menu";
import type { ActionState } from "@/lib/actions/menu";

const initialState: ActionState = {};

// Same confirm word as delete-tournament-button.tsx, for the same reason:
// deleting a section cascades every drink in it, and a typed word is a
// stronger gate than a plain Cancel/Delete pair once there's real content to
// lose - even though a menu item is easier to recreate than a match result,
// so this stays a client-only gate (no server-side acknowledgement flag).
const DELETE_CONFIRM_WORD = "ВИДАЛИТИ";

function DeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={disabled || pending}>
      {pending ? "Видалення…" : "Видалити"}
    </Button>
  );
}

export function DeleteMenuSectionButton({ id, name, itemCount }: { id: string; name: string; itemCount: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteMenuSectionAction, initialState);
  const [confirmText, setConfirmText] = useState("");
  const [handledState, setHandledState] = useState(state);
  if (state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

  const needsDeleteConfirmation = itemCount > 0;
  const deleteConfirmed = confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2Icon />
        <span className="sr-only">Видалити секцію</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити секцію «{name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemCount > 0
                ? `Разом з нею видаляться всі ${itemCount} ${itemCount === 1 ? "напій" : "напоїв"} у ній. Цю дію не можна скасувати.`
                : "Цю дію не можна скасувати."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {needsDeleteConfirmation && (
            <div className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor="menu-section-delete-confirm" className="text-sm">
                Введіть <span className="font-semibold">{DELETE_CONFIRM_WORD}</span>, щоб підтвердити
              </Label>
              <Input
                id="menu-section-delete-confirm"
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
