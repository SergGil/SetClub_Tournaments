"use client";

import { XIcon } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
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
import type { ActionState } from "@/lib/actions/tournaments";

function AddButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending ? "Додавання…" : count > 1 ? `Додати всіх (${count})` : "Додати"}
    </Button>
  );
}

const initialState: ActionState = {};

export function TournamentRoster({
  tournamentId,
  participants,
  availablePlayers,
}: {
  tournamentId: string;
  participants: { playerId: string; seed: number | null; player: { id: string; name: string } }[];
  availablePlayers: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(addParticipantAction, initialState);
  const [selected, setSelected] = useState<string[]>([]);

  const [handledState, setHandledState] = useState(state);
  if (state.success && state !== handledState) {
    setHandledState(state);
    setSelected([]);
  }

  const selectedPlayers = availablePlayers.filter((player) => selected.includes(player.id));

  return (
    <div className="flex flex-col gap-4">
      {availablePlayers.length > 0 && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="tournamentId" value={tournamentId} />
          {selected.map((id) => (
            <input key={id} type="hidden" name="playerId" value={id} />
          ))}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              multiple
              value={selected}
              onValueChange={(value) => setSelected(value ?? [])}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Обрати гравців">
                  {(value: string[]) =>
                    value.length > 0 ? `Обрано гравців: ${value.length}` : "Обрати гравців"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availablePlayers.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddButton count={selected.length} />
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
        </form>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <ul className="flex flex-col gap-1">
        {participants.map((entry) => (
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
        {participants.length === 0 && (
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
