"use client";

import { PencilIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { updateTournamentGroupAction, updateTournamentGroupPairsAction } from "@/lib/actions/tournaments";
import { fullDisplayName } from "@/lib/player-display";

/** A pair-row being edited; empty strings mean that slot hasn't been picked yet. */
type PairSlot = { a: string; b: string };

// Typed into the confirm field before a pair change is allowed to wipe a
// group's completed, scored matches - same pattern as the doubles
// randomizer's own re-run confirmation.
const DELETE_CONFIRM_WORD = "ВИДАЛИТИ";

/**
 * Edit affordance for a custom "Додаткові групи" heading (see
 * createTournamentGroupAction/AddTournamentGroupDialog) - admin-only,
 * rendered next to DeleteTournamentGroupButton via
 * TournamentStandingsSection's renderGroupHeaderExtra slot. Mirrors
 * AddTournamentGroupDialog's own name+player-picker form rather than sharing
 * a single create/edit component with it - the two are triggered from very
 * different contexts (a standalone "Додати групу" button vs. a small icon
 * next to an existing group's heading) and there's only this one call site,
 * so unifying them isn't worth the extra prop-mode indirection.
 *
 * For a DOUBLES tournament the group's roster is edited as pairs, same as
 * AddTournamentGroupDialog. Renaming without changing any pair is a pure
 * rename - it never touches the matches themselves, just carries their
 * round tag over to the new name. Actually changing the pairs regenerates
 * that group's entire round robin from scratch (its matches only, never the
 * rest of the tournament's), requiring a typed confirmation first if any of
 * the matches being replaced are already COMPLETED with a recorded score.
 */
export function EditTournamentGroupDialog({
  tournamentId,
  groupId,
  groupName,
  memberIds,
  existingPairs,
  participants,
  isDoubles,
}: {
  tournamentId: string;
  groupId: string;
  groupName: string;
  /** This group's current member playerIds - pre-selects the picker (non-doubles only). */
  memberIds: string[];
  /** This group's current teams, derived from its own matches (doubles only) - pre-fills the pair rows. */
  existingPairs: [string, string][];
  /** Every current tournament participant, so the admin can add someone new to the group too, not just remove existing members. */
  participants: { id: string; name: string; nickname: string | null }[];
  /** DOUBLES tournaments edit pairs; every other format keeps the plain player picker. */
  isDoubles: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(groupName);
  const [selected, setSelected] = useState<string[]>(memberIds);
  const [pairSlots, setPairSlots] = useState<PairSlot[]>(existingPairs.map(([a, b]) => ({ a, b })));
  const [search, setSearch] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedPlayers = participants.filter((p) => selected.includes(p.id));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredParticipants = normalizedSearch
    ? participants.filter(
        (p) =>
          p.name.toLowerCase().includes(normalizedSearch) ||
          p.nickname?.toLowerCase().includes(normalizedSearch),
      )
    : participants;

  const takenIds = new Set(pairSlots.flatMap((s) => [s.a, s.b]).filter(Boolean));
  const availableCount = participants.length - takenIds.size;
  const hasIncompletePair = pairSlots.some((s) => Boolean(s.a) !== Boolean(s.b));
  const deleteConfirmed = confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  function resetDraft() {
    setName(groupName);
    setSelected(memberIds);
    setPairSlots(existingPairs.map(([a, b]) => ({ a, b })));
    setSearch("");
    setNeedsConfirmation(false);
    setConfirmText("");
  }

  function updateSlot(index: number, next: PairSlot) {
    setPairSlots((prev) => prev.map((s, i) => (i === index ? next : s)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      if (isDoubles) {
        const pairs = pairSlots.filter((s) => s.a && s.b).map((s): [string, string] => [s.a, s.b]);
        const result = await updateTournamentGroupPairsAction(
          tournamentId,
          groupId,
          name,
          pairs,
          needsConfirmation && deleteConfirmed,
        );
        if (result?.error) {
          if (result.error.includes("завершених матчів")) setNeedsConfirmation(true);
          toast.error(result.error);
        } else {
          setOpen(false);
        }
        return;
      }

      const result = await updateTournamentGroupAction(tournamentId, groupId, name, selected);
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
        if (next) resetDraft();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">Редагувати групу «{groupName}»</span>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Редагувати групу</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-group-name">Назва групи</Label>
            <Input
              id="edit-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, Плейофф"
              maxLength={50}
              autoFocus
              required
            />
          </div>

          {isDoubles ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Пари (опційно)</p>
              {pairSlots.length > 0 && (
                <div className="flex flex-col gap-2">
                  {pairSlots.map((slot, index) => (
                    <GroupPairRow
                      key={index}
                      participants={participants}
                      value={slot}
                      takenIds={takenIds}
                      onChange={(next) => updateSlot(index, next)}
                      onRemove={() => setPairSlots((prev) => prev.filter((_, i) => i !== index))}
                    />
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={availableCount < 2}
                onClick={() => setPairSlots((prev) => [...prev, { a: "", b: "" }])}
              >
                Додати пару
              </Button>
              <p className="text-xs text-muted-foreground">
                Якщо змінити пари, збереження перебудує всі матчі цієї групи (кругова система) під нові пари.
              </p>
              {needsConfirmation && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-group-delete-confirm" className="text-sm">
                    Введіть <span className="font-semibold">{DELETE_CONFIRM_WORD}</span>, щоб
                    підтвердити видалення завершених матчів групи
                  </Label>
                  <Input
                    id="edit-group-delete-confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          ) : (
            participants.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Гравці (опційно)</Label>
                <Select
                  multiple
                  value={selected}
                  onValueChange={(value) => setSelected(value ?? [])}
                  onOpenChange={(next) => {
                    if (!next) setSearch("");
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Обрати гравців для групи">
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
                    {filteredParticipants.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {fullDisplayName(player)}
                      </SelectItem>
                    ))}
                    {filteredParticipants.length === 0 && (
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
            )
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || !name.trim() || hasIncompletePair || (needsConfirmation && !deleteConfirmed)}
            >
              {pending ? "Збереження…" : "Зберегти"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GroupPairRow({
  participants,
  value,
  takenIds,
  onChange,
  onRemove,
}: {
  participants: { id: string; name: string; nickname: string | null }[];
  value: PairSlot;
  takenIds: Set<string>;
  onChange: (next: PairSlot) => void;
  onRemove: () => void;
}) {
  function optionsFor(current: string) {
    return participants.filter((p) => p.id === current || !takenIds.has(p.id));
  }

  const aOptions = optionsFor(value.a);
  const bOptions = optionsFor(value.b);

  return (
    <div className="flex items-center gap-2">
      <Select
        items={Object.fromEntries(aOptions.map((p) => [p.id, fullDisplayName(p)]))}
        value={value.a}
        onValueChange={(next) => onChange({ ...value, a: next ?? "" })}
      >
        <SelectTrigger className="w-full min-w-0" aria-label="Гравець 1">
          <SelectValue placeholder="Гравець 1" />
        </SelectTrigger>
        <SelectContent>
          {aOptions.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {fullDisplayName(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">+</span>
      <Select
        items={Object.fromEntries(bOptions.map((p) => [p.id, fullDisplayName(p)]))}
        value={value.b}
        onValueChange={(next) => onChange({ ...value, b: next ?? "" })}
      >
        <SelectTrigger className="w-full min-w-0" aria-label="Гравець 2">
          <SelectValue placeholder="Гравець 2" />
        </SelectTrigger>
        <SelectContent>
          {bOptions.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {fullDisplayName(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}>
        <XIcon />
        <span className="sr-only">Прибрати пару</span>
      </Button>
    </div>
  );
}
