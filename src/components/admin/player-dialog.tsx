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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPlayerAction, updatePlayerAction } from "@/lib/actions/players";
import type { ActionState } from "@/lib/actions/players";
import { GENDER_LABEL } from "@/lib/validation/player";

const UNSPECIFIED = "UNSPECIFIED";
const genderItems = { [UNSPECIFIED]: "Не вказано", ...GENDER_LABEL };

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
  player?: { id: string; name: string; email: string | null; gender?: string | null };
};

export function PlayerDialog({ trigger, player }: PlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState(player?.gender ?? UNSPECIFIED);
  const action = player ? updatePlayerAction : createPlayerAction;
  const [state, formAction] = useActionState(action, initialState);

  // Adjusts state during render (react.dev's "storing information from
  // previous renders" pattern - a useState setter call here is fine, unlike
  // mutating a ref during render or calling setState inside an effect,
  // both of which this project's stricter Compiler-aware lint rules
  // reject). Deliberately NOT gated on `open`: a save that resolves after
  // the admin already closed the dialog must still mark `state` as handled
  // here, or the *next* time this same dialog is reopened, this would see
  // that same already-resolved state as new and close it again.
  const [handledState, setHandledState] = useState(state);
  if (state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
    if (!player) setGender(UNSPECIFIED);
  }
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Discard any draft left over from a previous cancelled edit.
          setGender(player?.gender ?? UNSPECIFIED);
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{player ? "Редагувати гравця" : "Додати гравця"}</DialogTitle>
            <DialogDescription>
              Email не обов&apos;язковий — вкажіть його, щоб гравець автоматично прив&apos;язався
              до свого Google-акаунту при вході.
            </DialogDescription>
          </DialogHeader>

          {player && <input type="hidden" name="id" value={player.id} />}

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Ім&apos;я</Label>
            <Input
              id="name"
              name="name"
              defaultValue={player?.name}
              required
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "player-name-error" : undefined}
            />
            {fieldErrors.name && (
              <p id="player-name-error" className="text-sm text-destructive">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email (опційно)</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={player?.email ?? ""}
              placeholder="player@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "player-email-error" : undefined}
            />
            {fieldErrors.email && (
              <p id="player-email-error" className="text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gender">Стать (опційно)</Label>
            <input type="hidden" name="gender" value={gender === UNSPECIFIED ? "" : gender} />
            <Select items={genderItems} value={gender} onValueChange={(v) => v && setGender(v)}>
              <SelectTrigger id="gender" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(genderItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
