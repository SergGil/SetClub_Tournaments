"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { createTournamentGroupAction } from "@/lib/actions/tournaments";

/**
 * Standalone "Додати групу" entry point for the standings tab (not the
 * roster tab - a custom group is meant to organize an *ongoing* tournament's
 * standings/matches, so it's created with whoever's already participating,
 * rather than empty and assigned one-by-one from each roster row's own
 * group picker).
 */
export function AddTournamentGroupDialog({
  tournamentId,
  participants,
}: {
  tournamentId: string;
  participants: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedPlayers = participants.filter((p) => selected.includes(p.id));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredParticipants = normalizedSearch
    ? participants.filter((p) => p.name.toLowerCase().includes(normalizedSearch))
    : participants;

  function reset() {
    setName("");
    setSelected([]);
    setSearch("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTournamentGroupAction(tournamentId, name, selected);
      if (result?.error) {
        toast.error(result.error);
      } else {
        setOpen(false);
        reset();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <PlusIcon /> Додати групу
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Додати групу</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-group-name">Назва групи</Label>
            <Input
              id="new-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, Плейофф"
              maxLength={50}
              autoFocus
              required
            />
          </div>

          {participants.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Гравці (опційно)</Label>
              <Select
                multiple
                value={selected}
                onValueChange={(value) => setSelected(value ?? [])}
                onOpenChange={(next) => {
                  if (!next) setSearch("");
                }}
              >
                <SelectTrigger className="w-full" aria-label="Обрати гравців для групи">
                  <SelectValue placeholder="Обрати гравців">
                    {(value: string[]) =>
                      value.length > 0 ? `Обрано гравців: ${value.length}` : "Обрати гравців"
                    }
                  </SelectValue>
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
                  {filteredParticipants.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name}
                    </SelectItem>
                  ))}
                  {filteredParticipants.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">Нічого не знайдено</p>
                  )}
                </SelectContent>
              </Select>

              {selectedPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedPlayers.map((player) => (
                    <Badge key={player.id} variant="secondary" className="gap-1">
                      {player.name}
                      <button
                        type="button"
                        onClick={() => setSelected((prev) => prev.filter((id) => id !== player.id))}
                        className="ml-0.5"
                      >
                        <XIcon className="size-3" />
                        <span className="sr-only">Прибрати з вибору</span>
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Створення…" : "Створити"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
