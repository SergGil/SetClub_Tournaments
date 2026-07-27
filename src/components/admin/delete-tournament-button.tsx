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
import { deleteTournamentAction } from "@/lib/actions/tournaments";
import type { ActionState } from "@/lib/actions/tournaments";

const initialState: ActionState = {};

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Видалення…" : "Видалити"}
    </Button>
  );
}

export function DeleteTournamentButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState(deleteTournamentAction, initialState);

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Trash2Icon /> Видалити турнір
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити турнір {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Усі матчі та результати цього турніру будуть видалені назавжди.
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
