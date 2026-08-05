"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function LinkButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={disabled || pending}>
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
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [state, formAction] = useActionState(linkPlayerAction, initialState);

  if (candidates.length === 0) {
    return <span className="text-xs text-muted-foreground">Немає незв&apos;язаних акаунтів</span>;
  }

  const items = Object.fromEntries(candidates.map((user) => [user.id, user.name ?? user.email]));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCandidates = normalizedSearch
    ? candidates.filter((user) =>
        [user.name, user.email]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalizedSearch)),
      )
    : candidates;

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="userId" value={selected} />
      <Select
        items={items}
        value={selected}
        onValueChange={(value) => setSelected(value ?? "")}
        onOpenChange={(open) => {
          if (!open) setSearch("");
        }}
      >
        <SelectTrigger className="w-56 overflow-hidden" size="sm" aria-label="Обрати акаунт">
          <SelectValue placeholder="Обрати акаунт" className="truncate" />
        </SelectTrigger>
        <SelectContent
          searchSlot={
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук…"
              className="h-7"
            />
          }
        >
          {filteredCandidates.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name ?? user.email}
            </SelectItem>
          ))}
          {filteredCandidates.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Нічого не знайдено</p>
          )}
        </SelectContent>
      </Select>
      <LinkButton disabled={selected === ""} />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
