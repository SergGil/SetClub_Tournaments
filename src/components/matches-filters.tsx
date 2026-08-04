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
import type { MatchStatusFilterValue } from "@/lib/queries/matches";

const ALL = "ALL";

/** "ALL" ("Усі статуси") is also the page's default when no status filter is chosen. */
export type StatusFilterSelection = MatchStatusFilterValue | "ALL";

const STATUS_LABEL: Record<string, string> = {
  [ALL]: "Усі статуси",
  SCHEDULED: "Заплановані",
  COMPLETED: "Завершені",
};

export function MatchesFilters({
  players,
  selectedPlayerId,
  selectedDate,
  selectedStatus,
}: {
  players: { id: string; name: string }[];
  selectedPlayerId?: string;
  selectedDate?: string;
  selectedStatus: StatusFilterSelection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const items = {
    [ALL]: "Усі гравці",
    ...Object.fromEntries(players.map((p) => [p.id, p.name])),
  };

  function pushFilters(next: { playerId?: string; date?: string; status: StatusFilterSelection }) {
    const params = new URLSearchParams();
    if (next.playerId) params.set("player", next.playerId);
    if (next.date) params.set("date", next.date);
    params.set("status", next.status);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilter = Boolean(selectedPlayerId || selectedDate || selectedStatus !== "ALL");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={items}
        value={selectedPlayerId ?? ALL}
        onValueChange={(value) =>
          pushFilters({
            playerId: value && value !== ALL ? value : undefined,
            date: selectedDate,
            status: selectedStatus,
          })
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

      <Select
        items={STATUS_LABEL}
        value={selectedStatus}
        onValueChange={(value) =>
          pushFilters({
            playerId: selectedPlayerId,
            date: selectedDate,
            status: (value as StatusFilterSelection) ?? "ALL",
          })
        }
      >
        <SelectTrigger className="w-full sm:w-44" aria-label="Фільтр за статусом">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Усі статуси</SelectItem>
          <SelectItem value="SCHEDULED">Заплановані</SelectItem>
          <SelectItem value="COMPLETED">Завершені</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={selectedDate ?? ""}
        onChange={(event) =>
          pushFilters({
            playerId: selectedPlayerId,
            date: event.target.value || undefined,
            status: selectedStatus,
          })
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
