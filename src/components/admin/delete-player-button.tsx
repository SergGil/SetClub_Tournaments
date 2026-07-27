"use client";

import { Trash2Icon } from "lucide-react";
import { useActionState } from "react";
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
  const [state, formAction] = useActionState(deletePlayerAction, initialState);

  return (
    <AlertDialog>
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
