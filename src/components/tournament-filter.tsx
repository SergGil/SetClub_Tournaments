"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "ALL";

export function TournamentFilter({
  tournaments,
  selectedId,
  opponent,
  result,
  type,
  year,
}: {
  tournaments: { id: string; name: string }[];
  selectedId: string;
  /** The currently active `?opponent=`/`?result=`/`?type=`/`?year=` filters (see the profile page's opponent filter and win/loss stat tiles) - preserved when the tournament changes instead of being silently dropped. */
  opponent?: string;
  result?: "win" | "loss";
  type?: "SINGLES" | "DOUBLES";
  year?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const items = {
    [ALL]: "Усі турніри",
    ...Object.fromEntries(tournaments.map((t) => [t.id, t.name])),
  };
  const normalizedSearch = search.trim().toLowerCase();
  const filteredTournaments = normalizedSearch
    ? tournaments.filter((t) => t.name.toLowerCase().includes(normalizedSearch))
    : tournaments;

  return (
    <Select
      items={items}
      value={selectedId || ALL}
      onValueChange={(value) => {
        const params = new URLSearchParams();
        if (opponent) params.set("opponent", opponent);
        if (value && value !== ALL) params.set("tournament", value);
        if (result) params.set("result", result);
        if (type) params.set("type", type);
        if (year) params.set("year", String(year));
        const qs = params.toString();
        // scroll: false - see opponent-filter.tsx for why.
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <SelectTrigger size="lg" className="w-full sm:w-64" aria-label="Фільтр за турніром">
        <SelectValue />
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
        <SelectItem value={ALL}>Усі турніри</SelectItem>
        {filteredTournaments.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
        {filteredTournaments.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Нічого не знайдено</p>
        )}
      </SelectContent>
    </Select>
  );
}
