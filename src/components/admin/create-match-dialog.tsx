"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

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
import { createMatchAction } from "@/lib/actions/matches";
import type { ActionState } from "@/lib/actions/matches";
import { matchTypeValues } from "@/lib/validation/match";
import type { TournamentFormat } from "@/lib/validation/tournament";

const MATCH_TYPE_LABEL: Record<(typeof matchTypeValues)[number], string> = {
  SINGLES: "Одиночний (1×1)",
  DOUBLES: "Парний (2×2)",
};

const EMPTY_SLOTS = ["", ""];

function allowedMatchTypes(format: TournamentFormat): (typeof matchTypeValues)[number][] {
  if (format === "MIXED") return [...matchTypeValues];
  if (format === "SINGLES") return ["SINGLES"];
  return ["DOUBLES"];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Створення…" : "Створити матч"}
    </Button>
  );
}

const initialState: ActionState = {};

export function CreateMatchDialog({
  tournamentId,
  format,
  roster,
}: {
  tournamentId: string;
  format: TournamentFormat;
  roster: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const options = allowedMatchTypes(format);
  const [matchType, setMatchType] = useState<(typeof matchTypeValues)[number]>(options[0]);
  const [state, formAction] = useActionState(createMatchAction, initialState);
  const slotsPerSide = matchType === "SINGLES" ? 1 : 2;

  const [sideA, setSideA] = useState<string[]>(EMPTY_SLOTS);
  const [sideB, setSideB] = useState<string[]>(EMPTY_SLOTS);

  const [handledState, setHandledState] = useState(state);
  if (open && state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
    setSideA(EMPTY_SLOTS);
    setSideB(EMPTY_SLOTS);
  }

  const takenIds = new Set(
    [...sideA.slice(0, slotsPerSide), ...sideB.slice(0, slotsPerSide)].filter(Boolean),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <PlusIcon /> Новий матч
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Новий матч</DialogTitle>
          </DialogHeader>

          <input type="hidden" name="tournamentId" value={tournamentId} />

          {options.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label>Тип матчу</Label>
              <Select
                items={MATCH_TYPE_LABEL}
                name="matchType"
                value={matchType}
                onValueChange={(value) => value && setMatchType(value as typeof matchType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((value) => (
                    <SelectItem key={value} value={value}>
                      {MATCH_TYPE_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {options.length === 1 && <input type="hidden" name="matchType" value={matchType} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PlayerSlots
              label="Сторона A"
              name="sideAPlayerIds"
              count={slotsPerSide}
              roster={roster}
              values={sideA}
              takenIds={takenIds}
              onChange={(index, value) =>
                setSideA((prev) => prev.map((v, i) => (i === index ? value : v)))
              }
            />
            <PlayerSlots
              label="Сторона B"
              name="sideBPlayerIds"
              count={slotsPerSide}
              roster={roster}
              values={sideB}
              takenIds={takenIds}
              onChange={(index, value) =>
                setSideB((prev) => prev.map((v, i) => (i === index ? value : v)))
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="round">Раунд (опційно)</Label>
              <Input id="round" name="round" placeholder="Наприклад, Фінал" maxLength={100} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduledDate">Дата (опційно)</Label>
              <Input id="scheduledDate" name="scheduledDate" type="date" />
            </div>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlayerSlots({
  label,
  name,
  count,
  roster,
  values,
  takenIds,
  onChange,
}: {
  label: string;
  name: string;
  count: number;
  roster: { id: string; name: string }[];
  values: string[];
  takenIds: Set<string>;
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {Array.from({ length: count }).map((_, index) => {
        const value = values[index] ?? "";
        // A player already picked in another slot (either side) can't be picked again.
        const available = roster.filter((player) => player.id === value || !takenIds.has(player.id));
        const items = Object.fromEntries(available.map((player) => [player.id, player.name]));

        return (
          <Select
            key={index}
            items={items}
            name={name}
            value={value}
            onValueChange={(next) => onChange(index, next ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Гравець" />
            </SelectTrigger>
            <SelectContent>
              {available.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  {player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </div>
  );
}
