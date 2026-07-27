"use client";

import { XIcon } from "lucide-react";
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
import { addParticipantAction, removeParticipantAction } from "@/lib/actions/tournaments";
import type { ActionState } from "@/lib/actions/tournaments";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Додавання…" : "Додати"}
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
  participants: { playerId: string; player: { id: string; name: string } }[];
  availablePlayers: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(addParticipantAction, initialState);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  return (
    <div className="flex flex-col gap-4">
      {availablePlayers.length > 0 && (
        <form action={formAction} className="flex items-end gap-2">
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="playerId" value={selected ?? ""} />
          <div className="flex flex-col gap-2">
            <Select value={selected} onValueChange={(value) => setSelected(value ?? undefined)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Обрати гравця" />
              </SelectTrigger>
              <SelectContent>
                {availablePlayers.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AddButton />
        </form>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <ul className="flex flex-col gap-1">
        {participants.map((entry) => (
          <li
            key={entry.playerId}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            {entry.player.name}
            <form action={removeParticipantAction.bind(null, tournamentId, entry.playerId)}>
              <Button type="submit" variant="ghost" size="icon-sm">
                <XIcon />
                <span className="sr-only">Прибрати</span>
              </Button>
            </form>
          </li>
        ))}
        {participants.length === 0 && (
          <p className="text-sm text-muted-foreground">Ще немає жодного учасника.</p>
        )}
      </ul>
    </div>
  );
}
