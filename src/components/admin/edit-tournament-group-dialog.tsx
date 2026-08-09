"use client";

import { PencilIcon, XIcon } from "lucide-react";
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
import { updateTournamentGroupAction } from "@/lib/actions/tournaments";
import { fullDisplayName } from "@/lib/player-display";

/**
 * Edit affordance for a custom "Додаткові групи" heading (see
 * createTournamentGroupAction/AddTournamentGroupDialog) - admin-only,
 * rendered next to DeleteTournamentGroupButton via
 * TournamentStandingsSection's renderGroupHeaderExtra slot. Mirrors
 * AddTournamentGroupDialog's own name+player-picker form rather than sharing
 * a single create/edit component with it - the two are triggered from very
 * different contexts (a standalone "Додати групу" button vs. a small icon
 * next to an existing group's heading) and there's only this one call site,
 * so unifying them isn't worth the extra prop-mode indirection.
 */
export function EditTournamentGroupDialog({
  tournamentId,
  groupId,
  groupName,
  memberIds,
  participants,
}: {
  tournamentId: string;
  groupId: string;
  groupName: string;
  /** This group's current member playerIds - pre-selects the picker. */
  memberIds: string[];
  /** Every current tournament participant, so the admin can add someone new to the group too, not just remove existing members. */
  participants: { id: string; name: string; nickname: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(groupName);
  const [selected, setSelected] = useState<string[]>(memberIds);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedPlayers = participants.filter((p) => selected.includes(p.id));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredParticipants = normalizedSearch
    ? participants.filter(
        (p) =>
          p.name.toLowerCase().includes(normalizedSearch) ||
          p.nickname?.toLowerCase().includes(normalizedSearch),
      )
    : participants;

  function resetDraft() {
    setName(groupName);
    setSelected(memberIds);
    setSearch("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateTournamentGroupAction(tournamentId, groupId, name, selected);
      if (result?.error) {
        toast.error(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetDraft();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">Редагувати групу «{groupName}»</span>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Редагувати групу</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-group-name">Назва групи</Label>
            <Input
              id="edit-group-name"
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
                      {fullDisplayName(player)}
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
                      {fullDisplayName(player)}
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
              {pending ? "Збереження…" : "Зберегти"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
