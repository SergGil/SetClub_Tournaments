"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { linkPlayerAction } from "@/lib/actions/players";
import type { ActionState } from "@/lib/actions/players";

const initialState: ActionState = {};

function LinkButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "…" : "Прив'язати"}
    </Button>
  );
}

export function LinkPlayerControl({
  playerId,
  candidates,
}: {
  playerId: string;
  candidates: { id: string; name: string | null; email: string }[];
}) {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [state, formAction] = useActionState(linkPlayerAction, initialState);

  if (candidates.length === 0) {
    return <span className="text-xs text-muted-foreground">Немає незв&apos;язаних акаунтів</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="userId" value={selected ?? ""} />
      <Select value={selected} onValueChange={(value) => setSelected(value ?? undefined)}>
        <SelectTrigger className="w-48" size="sm">
          <SelectValue placeholder="Обрати акаунт" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name ?? user.email} ({user.email})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <LinkButton />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
