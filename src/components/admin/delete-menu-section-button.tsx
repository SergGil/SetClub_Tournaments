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
import { deleteMenuSectionAction } from "@/lib/actions/menu";
import type { ActionState } from "@/lib/actions/menu";

const initialState: ActionState = {};

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Видалення…" : "Видалити"}
    </Button>
  );
}

export function DeleteMenuSectionButton({ id, name, itemCount }: { id: string; name: string; itemCount: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteMenuSectionAction, initialState);
  const [handledState, setHandledState] = useState(state);
  if (state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
