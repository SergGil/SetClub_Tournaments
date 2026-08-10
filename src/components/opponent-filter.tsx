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

export function OpponentFilter({
  opponents,
  selectedId,
  result,
  type,
  year,
}: {
  opponents: { id: string; name: string }[];
  selectedId: string;
  /** The currently active `?result=`/`?type=`/`?year=` filters (see the profile page's win/loss stat tiles and format/year pills) - preserved when the opponent changes instead of being silently dropped. */
  result?: "win" | "loss";
  type?: "SINGLES" | "DOUBLES";
  year?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const items = {
    [ALL]: "Усі суперники",
    ...Object.fromEntries(opponents.map((o) => [o.id, o.name])),
  };
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOpponents = normalizedSearch
    ? opponents.filter((o) => o.name.toLowerCase().includes(normalizedSearch))
    : opponents;

  return (
    <Select
      items={items}
      value={selectedId || ALL}
      onValueChange={(value) => {
        const params = new URLSearchParams();
        if (value && value !== ALL) params.set("opponent", value);
        if (result) params.set("result", result);
        if (type) params.set("type", type);
        if (year) params.set("year", String(year));
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
      }}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <SelectTrigger size="lg" className="w-full sm:w-64" aria-label="Фільтр за суперником">
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
        <SelectItem value={ALL}>Усі суперники</SelectItem>
        {filteredOpponents.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
        {filteredOpponents.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Нічого не знайдено</p>
        )}
      </SelectContent>
    </Select>
  );
}
