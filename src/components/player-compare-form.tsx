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

// Sentinel for "not chosen yet" - same reasoning as OpponentFilter's ALL:
// this Select always needs its current `value` present among `items` to
// render a label, so "nothing selected" needs its own real item rather than
// an empty string.
const EMPTY = "EMPTY";

function PlayerSelect({
  label,
  players,
  excludeId,
  value,
  onChange,
}: {
  label: string;
  players: { id: string; name: string }[];
  excludeId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  // Can't compare a player against themselves - the other select's current
  // pick disappears from this list instead of just being disabled, so there's
  // no dead option sitting in the list.
  const options = players.filter((p) => p.id !== excludeId);
  const items = { [EMPTY]: label, ...Object.fromEntries(options.map((p) => [p.id, p.name])) };
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? options.filter((p) => p.name.toLowerCase().includes(normalizedSearch))
    : options;

  return (
    <Select
      items={items}
      value={value || EMPTY}
      onValueChange={(id) => onChange(!id || id === EMPTY ? "" : id)}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <SelectTrigger size="lg" className="w-full sm:w-56" aria-label={label}>
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
        <SelectItem value={EMPTY} className="text-muted-foreground">
          {label}
        </SelectItem>
        {filtered.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Нічого не знайдено</p>
        )}
      </SelectContent>
    </Select>
  );
}

/** Picks the two players for /rating/compare - see docs/DESIGN_ROADMAP_2026.md #6. */
export function PlayerCompareForm({
  players,
  selectedA,
  selectedB,
  format,
}: {
  players: { id: string; name: string }[];
  selectedA: string;
  selectedB: string;
  format: "singles" | "doubles";
}) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(a: string, b: string) {
    const params = new URLSearchParams();
    if (a) params.set("a", a);
    if (b) params.set("b", b);
    if (format !== "singles") params.set("format", format);
    const qs = params.toString();
    // scroll: false - re-picking a player shouldn't yank the viewer back to
    // the top of the page (same fix as opponent-filter.tsx/tournament-filter.tsx).
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <PlayerSelect label="Гравець 1" players={players} excludeId={selectedB} value={selectedA} onChange={(id) => navigate(id, selectedB)} />
      <span className="text-sm font-medium text-muted-foreground">проти</span>
      <PlayerSelect label="Гравець 2" players={players} excludeId={selectedA} value={selectedB} onChange={(id) => navigate(selectedA, id)} />
    </div>
  );
}
