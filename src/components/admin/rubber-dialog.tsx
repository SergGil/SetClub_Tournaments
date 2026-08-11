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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionState } from "@/lib/actions/matches";
import { createRubberAction } from "@/lib/actions/ties";
import { fullDisplayName } from "@/lib/player-display";
import { matchTypeValues } from "@/lib/validation/match";

const MATCH_TYPE_LABEL: Record<(typeof matchTypeValues)[number], string> = {
  SINGLES: "Одиночний (1×1)",
  DOUBLES: "Парний (2×2)",
};

type RosterPlayer = { id: string; name: string; nickname: string | null };
const EMPTY_SLOTS = ["", ""];

/**
 * Trimmed sibling of create-match-dialog.tsx's own PlayerSlots (duplicated,
 * not imported/exported - see docs/TOURNAMENT_TEAMS.md's "files deliberately
 * untouched" note) - each side's roster is restricted to one specific team's
 * members instead of the whole tournament roster, the entire reason a rubber
 * needs its own dialog rather than reusing MatchDialog for creation.
 */
function RubberPlayerSlots({
  label,
  name,
  count,
  roster,
  values,
  onChange,
}: {
  label: string;
  name: string;
  count: number;
  roster: RosterPlayer[];
  values: string[];
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {Array.from({ length: count }).map((_, index) => {
        const value = values[index] ?? "";
        const available = roster.filter((player) => player.id === value || !values.includes(player.id));
        const items = Object.fromEntries(available.map((player) => [player.id, fullDisplayName(player)]));

        return (
          <Select
            key={index}
            items={items}
            name={name}
            value={value}
            onValueChange={(next) => onChange(index, next ?? "")}
          >
            <SelectTrigger className="w-full" aria-label={count > 1 ? `${label}, гравець ${index + 1}` : label}>
              <SelectValue placeholder="Гравець" />
            </SelectTrigger>
            <SelectContent>
              {available.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  {fullDisplayName(player)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </div>
  );
}

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Створення…" : "Створити раббер"}
    </Button>
  );
}

/** Creates one rubber (a normal SINGLES/DOUBLES Match tagged with tieId) for a tie - see createRubberAction. */
export function RubberDialog({
  tieId,
  teamAName,
  teamBName,
  teamAMembers,
  teamBMembers,
}: {
  tieId: string;
  teamAName: string;
  teamBName: string;
  teamAMembers: RosterPlayer[];
  teamBMembers: RosterPlayer[];
}) {
  const [open, setOpen] = useState(false);
  const [matchType, setMatchType] = useState<(typeof matchTypeValues)[number]>("SINGLES");
  const slotsPerSide = matchType === "SINGLES" ? 1 : 2;
  const [sideA, setSideA] = useState<string[]>(EMPTY_SLOTS);
  const [sideB, setSideB] = useState<string[]>(EMPTY_SLOTS);

  const [state, formAction] = useActionState(createRubberAction, initialState);
  const [handledState, setHandledState] = useState(state);
  if (state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

  function resetDraft() {
    setMatchType("SINGLES");
    setSideA(EMPTY_SLOTS);
    setSideB(EMPTY_SLOTS);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetDraft();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PlusIcon /> Додати раббер
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Додати раббер</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="tieId" value={tieId} />

          <div className="flex flex-col gap-2">
            <Label>Тип раббера</Label>
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
                {matchTypeValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {MATCH_TYPE_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RubberPlayerSlots
              label={teamAName}
              name="sideAPlayerIds"
              count={slotsPerSide}
              roster={teamAMembers}
              values={sideA}
              onChange={(index, value) => setSideA((prev) => prev.map((v, i) => (i === index ? value : v)))}
            />
            <RubberPlayerSlots
              label={teamBName}
              name="sideBPlayerIds"
              count={slotsPerSide}
              roster={teamBMembers}
              values={sideB}
              onChange={(index, value) => setSideB((prev) => prev.map((v, i) => (i === index ? value : v)))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rubber-scheduledDate">Дата (опційно)</Label>
            <Input id="rubber-scheduledDate" name="scheduledDate" type="date" />
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
