"use client";

import { usePathname, useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "ALL";

export function MatchesFilters({
  players,
  selectedPlayerId,
  selectedDate,
}: {
  players: { id: string; name: string }[];
  selectedPlayerId?: string;
  selectedDate?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const items = {
    [ALL]: "Усі гравці",
    ...Object.fromEntries(players.map((p) => [p.id, p.name])),
  };

  function pushFilters(next: { playerId?: string; date?: string }) {
    const params = new URLSearchParams();
    if (next.playerId) params.set("player", next.playerId);
    if (next.date) params.set("date", next.date);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilter = Boolean(selectedPlayerId || selectedDate);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={items}
        value={selectedPlayerId ?? ALL}
        onValueChange={(value) =>
          pushFilters({ playerId: value && value !== ALL ? value : undefined, date: selectedDate })
        }
      >
        <SelectTrigger className="w-full sm:w-56" aria-label="Фільтр за гравцем">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Усі гравці</SelectItem>
          {players.map((player) => (
            <SelectItem key={player.id} value={player.id}>
              {player.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={selectedDate ?? ""}
        onChange={(event) =>
          pushFilters({ playerId: selectedPlayerId, date: event.target.value || undefined })
        }
        aria-label="Фільтр за датою"
        className="w-full sm:w-44"
      />

      {hasFilter && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Скинути фільтри
        </button>
      )}
    </div>
  );
}
