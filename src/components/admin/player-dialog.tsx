"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPlayerAction, updatePlayerAction } from "@/lib/actions/players";
import type { ActionState } from "@/lib/actions/players";

const initialState: ActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Збереження…" : label}
    </Button>
  );
}

type PlayerDialogProps = {
  trigger: React.ReactElement;
  player?: { id: string; name: string; email: string | null };
};

export function PlayerDialog({ trigger, player }: PlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const action = player ? updatePlayerAction : createPlayerAction;
  const [state, formAction] = useActionState(action, initialState);

  // useActionState's `state` stays truthy forever after the first success, so
  // guard on its identity (a fresh object per submission) rather than the
  // value alone - otherwise every reopen would immediately auto-close again.
  const [handledState, setHandledState] = useState(state);
  if (open && state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{player ? "Редагувати гравця" : "Новий гравець"}</DialogTitle>
            <DialogDescription>
              Email не обов&apos;язковий — вкажіть його, щоб гравець автоматично прив&apos;язався
              до свого Google-акаунту при вході.
            </DialogDescription>
          </DialogHeader>

          {player && <input type="hidden" name="id" value={player.id} />}

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Ім&apos;я</Label>
            <Input id="name" name="name" defaultValue={player?.name} required maxLength={100} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email (опційно)</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={player?.email ?? ""}
              placeholder="player@example.com"
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <SubmitButton label={player ? "Зберегти" : "Створити"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
