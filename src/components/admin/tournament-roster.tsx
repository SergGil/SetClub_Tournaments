"use client";

import { XIcon } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  toggleParticipantSeedAction,
} from "@/lib/actions/tournaments";

type Participant = { playerId: string; seed: number | null; player: { id: string; name: string } };

export function TournamentRoster({
  tournamentId,
  participants,
  availablePlayers,
}: {
  tournamentId: string;
  participants: Participant[];
  availablePlayers: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function handleAdd() {
    const playersToAdd = selectedPlayers;
    if (playersToAdd.length === 0) return;
    const ids = playersToAdd.map((p) => p.id);
    startTransition(async () => {
      addOptimisticParticipants(
        playersToAdd.map((player) => ({ playerId: player.id, seed: null, player })),
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
            <Select multiple value={selected} onValueChange={(value) => setSelected(value ?? [])}>
              <SelectTrigger className="w-full sm:w-56" aria-label="Обрати гравців">
                <SelectValue placeholder="Обрати гравців">
                  {(value: string[]) =>
                    value.length > 0 ? `Обрано гравців: ${value.length}` : "Обрати гравців"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {pickable.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>
                ))}
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
