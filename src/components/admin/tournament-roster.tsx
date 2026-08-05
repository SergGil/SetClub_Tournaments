"use client";

import { XIcon } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addParticipantAction,
  removeParticipantAction,
  setParticipantGroupAction,
  toggleParticipantSeedAction,
} from "@/lib/actions/tournaments";
import { MAX_TOURNAMENT_GROUPS } from "@/lib/randomize-pairs";
import type { TournamentFormat } from "@/lib/validation/tournament";

type Participant = {
  playerId: string;
  seed: number | null;
  group: number | null;
  player: { id: string; name: string };
};

export function TournamentRoster({
  tournamentId,
  format,
  participants,
  availablePlayers,
}: {
  tournamentId: string;
  format: TournamentFormat;
  participants: Participant[];
  availablePlayers: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  // Shows newly-added players in the roster list the instant "Додати" is
  // clicked instead of waiting on the mutation + revalidation round-trip
  // (a few seconds against the remote DB) - reconciles automatically once
  // the real `participants` prop catches up.
  const [optimisticParticipants, addOptimisticParticipants] = useOptimistic(
    participants,
    (state, added: Participant[]) => [
      ...state,
      ...added.filter((a) => !state.some((s) => s.playerId === a.playerId)),
    ],
  );

  const optimisticRosterIds = new Set(optimisticParticipants.map((p) => p.playerId));
  const pickable = availablePlayers.filter((player) => !optimisticRosterIds.has(player.id));
  const selectedPlayers = pickable.filter((player) => selected.includes(player.id));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredPickable = normalizedSearch
    ? pickable.filter((player) => player.name.toLowerCase().includes(normalizedSearch))
    : pickable;

  function handleAdd() {
    const playersToAdd = selectedPlayers;
    if (playersToAdd.length === 0) return;
    const ids = playersToAdd.map((p) => p.id);
    startTransition(async () => {
      addOptimisticParticipants(
        playersToAdd.map((player) => ({ playerId: player.id, seed: null, group: null, player })),
      );
      const result = await addParticipantAction(tournamentId, ids);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        setSelected([]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {pickable.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              multiple
              value={selected}
              onValueChange={(value) => setSelected(value ?? [])}
              onOpenChange={(open) => {
                if (!open) setSearch("");
              }}
            >
              <SelectTrigger className="w-full sm:w-56" aria-label="Обрати гравців">
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
                {filteredPickable.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>
                ))}
                {filteredPickable.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Нічого не знайдено</p>
                )}
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleAdd} disabled={isPending || selected.length === 0}>
              {isPending
                ? "Додавання…"
                : selected.length > 1
                  ? `Додати всіх (${selected.length})`
                  : "Додати"}
            </Button>
          </div>

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
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="flex flex-col gap-1">
        {optimisticParticipants.map((entry) => (
          <li
            key={entry.playerId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
          >
            <span className="break-words">{entry.player.name}</span>
            <div className="flex items-center gap-3">
              {format === "SINGLES" && (
                <GroupSelect
                  tournamentId={tournamentId}
                  playerId={entry.playerId}
                  group={entry.group}
                />
              )}
              <SeedToggle
                tournamentId={tournamentId}
                playerId={entry.playerId}
                seeded={entry.seed !== null}
              />
              <RemoveParticipantButton tournamentId={tournamentId} playerId={entry.playerId} />
            </div>
          </li>
        ))}
        {optimisticParticipants.length === 0 && (
          <p className="text-sm text-foreground/80">Ще немає жодного учасника.</p>
        )}
      </ul>
    </div>
  );
}

function RemoveParticipantButton({
  tournamentId,
  playerId,
}: {
  tournamentId: string;
  playerId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await removeParticipantAction(tournamentId, playerId);
            if (result?.error) toast.error(result.error);
          } catch {
            toast.error("Не вдалося прибрати учасника");
          }
        });
      }}
    >
      <XIcon />
      <span className="sr-only">Прибрати</span>
    </Button>
  );
}

function SeedToggle({
  tournamentId,
  playerId,
  seeded,
}: {
  tournamentId: string;
  playerId: string;
  seeded: boolean;
}) {
  const [, startTransition] = useTransition();
  const id = `seed-${tournamentId}-${playerId}`;

  // Optimistic local value so the checkbox flips instantly instead of
  // waiting on the server action + revalidation round-trip. Resynced from
  // the server-derived `seeded` prop whenever it actually changes.
  const [prevSeeded, setPrevSeeded] = useState(seeded);
  const [optimisticSeeded, setOptimisticSeeded] = useState(seeded);
  if (seeded !== prevSeeded) {
    setPrevSeeded(seeded);
    setOptimisticSeeded(seeded);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Checkbox
        id={id}
        checked={optimisticSeeded}
        onCheckedChange={(checked) => {
          setOptimisticSeeded(checked);
          startTransition(async () => {
            try {
              await toggleParticipantSeedAction(tournamentId, playerId, checked);
            } catch {
              setOptimisticSeeded(seeded);
            }
          });
        }}
      />
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        Сіяний
      </Label>
    </div>
  );
}

const GROUP_NONE = "none";
// Prefixed rather than plain "1".."6" - Base UI's Select label lookup
// (items[value]) breaks for a plain-integer-string key mixed with a
// non-numeric one, since JS object property order forces integer-like keys
// to the front regardless of insertion order, which confuses its internal
// value/index resolution and renders the trigger's label as "undefined".
const GROUP_VALUE_PREFIX = "group-";
const GROUP_SELECT_ITEMS: Record<string, string> = {
  [GROUP_NONE]: "Без групи",
  ...Object.fromEntries(
    Array.from({ length: MAX_TOURNAMENT_GROUPS }, (_, i) => [`${GROUP_VALUE_PREFIX}${i + 1}`, `Група ${i + 1}`]),
  ),
};

function GroupSelect({
  tournamentId,
  playerId,
  group,
}: {
  tournamentId: string;
  playerId: string;
  group: number | null;
}) {
  const [, startTransition] = useTransition();

  // Same optimistic-local-state pattern as SeedToggle above.
  const [prevGroup, setPrevGroup] = useState(group);
  const [optimisticGroup, setOptimisticGroup] = useState(group);
  if (group !== prevGroup) {
    setPrevGroup(group);
    setOptimisticGroup(group);
  }

  return (
    <Select
      items={GROUP_SELECT_ITEMS}
      value={optimisticGroup === null ? GROUP_NONE : `${GROUP_VALUE_PREFIX}${optimisticGroup}`}
      onValueChange={(value) => {
        if (!value) return;
        const next = value === GROUP_NONE ? null : Number(value.slice(GROUP_VALUE_PREFIX.length));
        setOptimisticGroup(next);
        startTransition(async () => {
          try {
            await setParticipantGroupAction(tournamentId, playerId, next);
          } catch {
            setOptimisticGroup(group);
          }
        });
      }}
    >
      <SelectTrigger className="h-7 w-28 text-xs" aria-label="Група">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(GROUP_SELECT_ITEMS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
