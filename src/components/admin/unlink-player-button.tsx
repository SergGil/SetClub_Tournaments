"use client";

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
import { unlinkPlayerAction } from "@/lib/actions/players";
import type { ActionState } from "@/lib/actions/players";

const initialState: ActionState = {};

function UnlinkButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Відв'язування…" : "Відв'язати"}
    </Button>
  );
}

export function UnlinkPlayerButton({ playerId, name }: { playerId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(unlinkPlayerAction, initialState);
  const [handledState, setHandledState] = useState(state);
  if (open && state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
        Відв&apos;язати
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="id" value={playerId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Відв&apos;язати акаунт від гравця {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Гравець стане заглушкою без акаунту. Google-акаунт зможе прив&apos;язатись знову
              автоматично (якщо email збігається) або вручну через адмінку.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <UnlinkButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
