"use client";

import { PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { createPadelTeamAction, deletePadelTeamAction, updatePadelTeamAction } from "@/lib/actions/padel-teams";
import { fullDisplayName } from "@/lib/player-display";

const MIN_TEAM_SIZE = 2;
const MAX_TEAM_SIZE = 4;

type RosterPlayer = { id: string; name: string; nickname: string | null };
export type PadelTeamWithMembers = { id: string; name: string; members: RosterPlayer[] };

function TeamPlayerPicker({
  participants,
  selected,
  onChange,
}: {
  participants: RosterPlayer[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const selectedPlayers = participants.filter((p) => selected.includes(p.id));
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? participants.filter(
        (p) =>
          p.name.toLowerCase().includes(normalizedSearch) ||
          p.nickname?.toLowerCase().includes(normalizedSearch),
      )
    : participants;

  return (
    <div className="flex flex-col gap-2">
      <Label>
        Гравці (від {MIN_TEAM_SIZE} до {MAX_TEAM_SIZE})
      </Label>
      <Select
        multiple
        value={selected}
        onValueChange={(value) => onChange((value ?? []).slice(0, MAX_TEAM_SIZE))}
        onOpenChange={(next) => {
          if (!next) setSearch("");
        }}
      >
        <SelectTrigger className="w-full" aria-label="Обрати гравців команди">
          <SelectValue placeholder="Обрати гравців">
            {(value: string[]) => (value.length > 0 ? `Обрано гравців: ${value.length}` : "Обрати гравців")}
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
          {filtered.map((player) => (
            <SelectItem
              key={player.id}
              value={player.id}
              disabled={!selected.includes(player.id) && selected.length >= MAX_TEAM_SIZE}
            >
              {fullDisplayName(player)}
            </SelectItem>
          ))}
          {filtered.length === 0 && (
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
                onClick={() => onChange(selected.filter((id) => id !== player.id))}
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
  );
}

function AddTeamDialog({
  tournamentId,
  participants,
}: {
  tournamentId: string;
  participants: RosterPlayer[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const validSize = selected.length >= MIN_TEAM_SIZE && selected.length <= MAX_TEAM_SIZE;

  function reset() {
    setName("");
    setSelected([]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createPadelTeamAction(tournamentId, name, selected);
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
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PlusIcon /> Створити команду
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Створити команду</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-padel-team-name">Назва команди</Label>
            <Input
              id="new-padel-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, Команда 1"
              maxLength={60}
              autoFocus
              required
            />
          </div>
          <TeamPlayerPicker participants={participants} selected={selected} onChange={setSelected} />
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim() || !validSize}>
              {pending ? "Створення…" : "Створити"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTeamDialog({
  tournamentId,
  team,
  participants,
}: {
  tournamentId: string;
  team: PadelTeamWithMembers;
  participants: RosterPlayer[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(team.name);
  const [selected, setSelected] = useState<string[]>(team.members.map((m) => m.id));
  const [pending, startTransition] = useTransition();
  const validSize = selected.length >= MIN_TEAM_SIZE && selected.length <= MAX_TEAM_SIZE;

  const pickable = [...participants, ...team.members.filter((m) => !participants.some((p) => p.id === m.id))];

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePadelTeamAction(tournamentId, team.id, name, selected);
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
        if (next) {
          setName(team.name);
          setSelected(team.members.map((m) => m.id));
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">Редагувати команду «{team.name}»</span>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Редагувати команду</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-padel-team-name">Назва команди</Label>
            <Input
              id="edit-padel-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
              required
            />
          </div>
          <TeamPlayerPicker participants={pickable} selected={selected} onChange={setSelected} />
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim() || !validSize}>
              {pending ? "Збереження…" : "Зберегти"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTeamButton({ tournamentId, team }: { tournamentId: string; team: PadelTeamWithMembers }) {
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deletePadelTeamAction(tournamentId, team.id);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" disabled={pending} />}>
        <XIcon />
        <span className="sr-only">Видалити команду «{team.name}»</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити команду «{team.name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Якщо команда вже бере участь у зустрічі, спершу видаліть цю зустріч.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete} disabled={pending}>
            {pending ? "Видалення…" : "Видалити"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Padel twin of tournament-teams.tsx. */
export function PadelTournamentTeams({
  tournamentId,
  teams,
  participants,
}: {
  tournamentId: string;
  teams: PadelTeamWithMembers[];
  participants: RosterPlayer[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Команди</h2>
        <AddTeamDialog tournamentId={tournamentId} participants={participants} />
      </div>
      {teams.length === 0 ? (
        <p className="text-sm text-foreground/80">Команд ще не створено.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{team.name}</span>
                <div className="flex flex-wrap gap-1">
                  {team.members.map((member) => (
                    <Badge key={member.id} variant="secondary">
                      {fullDisplayName(member)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <EditTeamDialog tournamentId={tournamentId} team={team} participants={participants} />
                <DeleteTeamButton tournamentId={tournamentId} team={team} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
