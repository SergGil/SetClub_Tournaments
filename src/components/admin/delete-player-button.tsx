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
import { deletePlayerAction } from "@/lib/actions/players";
import type { ActionState } from "@/lib/actions/players";

const initialState: ActionState = {};

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Видалення…" : "Видалити"}
    </Button>
  );
}

export function DeletePlayerButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deletePlayerAction, initialState);
  // Adjusts state during render (react.dev's "storing information from
  // previous renders" pattern - a useState setter call here is fine, unlike
  // mutating a ref during render or calling setState inside an effect,
  // both of which this project's stricter Compiler-aware lint rules
  // reject). Deliberately NOT gated on `open`: a delete that resolves after
  // the admin already closed the dialog must still mark `state` as handled
  // here, or the *next* time it's reopened, this would see that same
  // already-resolved state as new and close it again.
  const [handledState, setHandledState] = useState(state);
  if (state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2Icon />
        <span className="sr-only">Видалити</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити гравця {name}?</AlertDialogTitle>
            <AlertDialogDescription>Цю дію не можна скасувати.</AlertDialogDescription>
          </AlertDialogHeader>
          {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <DeleteButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
