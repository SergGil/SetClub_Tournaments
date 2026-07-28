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
import { deleteMatchAction } from "@/lib/actions/matches";
import type { ActionState } from "@/lib/actions/matches";

const initialState: ActionState = {};

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Видалення…" : "Видалити"}
    </Button>
  );
}

export function DeleteMatchButton({ matchId }: { matchId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteMatchAction, initialState);
  const [handledState, setHandledState] = useState(state);
  if (open && state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2Icon />
        <span className="sr-only">Видалити матч</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="matchId" value={matchId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити матч?</AlertDialogTitle>
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
