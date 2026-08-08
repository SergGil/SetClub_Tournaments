"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMatchAction, updateMatchAction } from "@/lib/actions/matches";
import type { ActionState } from "@/lib/actions/matches";
import { fullDisplayName } from "@/lib/player-display";
import {
  BRACKET_ROUND_PICKER_OPTIONS,
  BRACKET_ROUNDS,
  isPlayoffRound,
  PLACEMENT_ROUNDS,
} from "@/lib/playoff-rounds";
import { matchTypeValues } from "@/lib/validation/match";
import type { TournamentFormat } from "@/lib/validation/tournament";

const MATCH_TYPE_LABEL: Record<(typeof matchTypeValues)[number], string> = {
  SINGLES: "Одиночний (1×1)",
  DOUBLES: "Парний (2×2)",
};

const EMPTY_SLOTS = ["", ""];

const ROUND_NONE = "__none__";
const ROUND_CUSTOM = "__custom__";

const ROUND_SELECT_LABELS: Record<string, string> = {
  [ROUND_NONE]: "Без раунду",
  ...Object.fromEntries(BRACKET_ROUNDS.map((r) => [r, r])),
  ...Object.fromEntries(PLACEMENT_ROUNDS.filter((r) => r !== "Фінал").map((r) => [r, r])),
  [ROUND_CUSTOM]: "Інше…",
};

/** Maps an existing match's round to the Select's selection + the fallback custom-text value. */
function deriveRoundSelection(round: string | null): { selection: string; customValue: string } {
  if (!round) return { selection: ROUND_NONE, customValue: "" };
  if (isPlayoffRound(round)) return { selection: round, customValue: "" };
  return { selection: ROUND_CUSTOM, customValue: round };
}

function allowedMatchTypes(format: TournamentFormat): (typeof matchTypeValues)[number][] {
  if (format === "MIXED") return [...matchTypeValues];
  if (format === "SINGLES") return ["SINGLES"];
  return ["DOUBLES"];
}

function toDateInputValue(date: Date | string | null): string {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Збереження…" : label}
    </Button>
  );
}

const initialState: ActionState = {};

type CreateInput = {
  matchType: (typeof matchTypeValues)[number];
  round: string | null;
  scheduledDate: string | null;
  sideAPlayerIds: string[];
  sideBPlayerIds: string[];
};

function readCreateInput(formData: FormData, matchType: (typeof matchTypeValues)[number]): CreateInput {
  const round = formData.get("round");
  const scheduledDate = formData.get("scheduledDate");
  const asStrings = (key: string) =>
    formData.getAll(key).filter((v): v is string => typeof v === "string");
  return {
    matchType,
    round: typeof round === "string" && round ? round : null,
    scheduledDate: typeof scheduledDate === "string" && scheduledDate ? scheduledDate : null,
    sideAPlayerIds: asStrings("sideAPlayerIds"),
    sideBPlayerIds: asStrings("sideBPlayerIds"),
  };
}

type MatchDialogProps = {
  trigger: React.ReactElement;
  tournamentId: string;
  format: TournamentFormat;
  roster: { id: string; name: string; nickname: string | null }[];
  match?: {
    id: string;
    matchType: (typeof matchTypeValues)[number];
    round: string | null;
    scheduledDate: Date | string | null;
    sideAPlayerIds: string[];
    sideBPlayerIds: string[];
  };
  /** Create mode only: shows the new match in the list immediately, before the server confirms. */
  onOptimisticCreate?: (input: CreateInput) => void;
};

export function MatchDialog({
  trigger,
  tournamentId,
  format,
  roster,
  match,
  onOptimisticCreate,
}: MatchDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const options = allowedMatchTypes(format);
  const [matchType, setMatchType] = useState<(typeof matchTypeValues)[number]>(
    match?.matchType ?? options[0],
  );
  const slotsPerSide = matchType === "SINGLES" ? 1 : 2;

  const [sideA, setSideA] = useState<string[]>(
    match ? [...match.sideAPlayerIds, ...EMPTY_SLOTS].slice(0, 2) : EMPTY_SLOTS,
  );
  const [sideB, setSideB] = useState<string[]>(
    match ? [...match.sideBPlayerIds, ...EMPTY_SLOTS].slice(0, 2) : EMPTY_SLOTS,
  );

  const [roundSelection, setRoundSelection] = useState(
    () => deriveRoundSelection(match?.round ?? null).selection,
  );
  const [customRound, setCustomRound] = useState(
    () => deriveRoundSelection(match?.round ?? null).customValue,
  );

  function resetDraft() {
    setSideA(EMPTY_SLOTS);
    setSideB(EMPTY_SLOTS);
  }

  // Edit mode keeps the plain form-action flow: no optimistic update, dialog
  // closes once the server confirms.
  const [updateState, updateFormAction] = useActionState(updateMatchAction, initialState);
  // Adjusts state during render (react.dev's "storing information from
  // previous renders" pattern - a useState setter call here is fine, unlike
  // mutating a ref during render or calling setState inside an effect,
  // both of which this project's stricter Compiler-aware lint rules
  // reject). Deliberately NOT gated on `open`: a save that resolves after
  // the admin already closed the dialog must still mark `updateState` as
  // handled here, or the *next* time the same dialog is reopened, this
  // would see that same already-resolved state as new and close it again.
  const [handledUpdateState, setHandledUpdateState] = useState(updateState);
  if (match && updateState.success && updateState !== handledUpdateState) {
    setHandledUpdateState(updateState);
    setOpen(false);
  }
  useEffect(() => {
    if (match && updateState.success && updateState.notice) {
      toast.info(updateState.notice);
    }
  }, [match, updateState]);

  // Create mode is handled manually (not via useActionState's form action)
  // so the dialog can close the instant it's submitted: a plain setState
  // call made *inside* a form-action transition doesn't paint until that
  // transition settles, which defeats the point of showing the optimistic
  // entry right away. Closing here happens before the transition starts;
  // the optimistic update and the real mutation happen inside it.
  const [isCreating, startCreateTransition] = useTransition();

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = readCreateInput(formData, matchType);

    setOpen(false);
    resetDraft();

    startCreateTransition(async () => {
      onOptimisticCreate?.(input);
      const result = await createMatchAction(initialState, formData);
      if (result.error) {
        toast.error(result.error);
        // The optimistic entry above assumed success - force a real refetch
        // so it clears once fresh data arrives (useOptimistic only
        // reconciles when the underlying data changes).
        router.refresh();
      } else if (result.notice) {
        toast.info(result.notice);
      }
    });
  }

  const takenIds = new Set(
    [...sideA.slice(0, slotsPerSide), ...sideB.slice(0, slotsPerSide)].filter(Boolean),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Discard any draft left over from a previous cancelled edit.
          setMatchType(match?.matchType ?? options[0]);
          setSideA(match ? [...match.sideAPlayerIds, ...EMPTY_SLOTS].slice(0, 2) : EMPTY_SLOTS);
          setSideB(match ? [...match.sideBPlayerIds, ...EMPTY_SLOTS].slice(0, 2) : EMPTY_SLOTS);
          const derivedRound = deriveRoundSelection(match?.round ?? null);
          setRoundSelection(derivedRound.selection);
          setCustomRound(derivedRound.customValue);
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form
          action={match ? updateFormAction : undefined}
          onSubmit={match ? undefined : handleCreateSubmit}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{match ? "Редагувати матч" : "Додати матч"}</DialogTitle>
          </DialogHeader>

          <input type="hidden" name="tournamentId" value={tournamentId} />
          {match && <input type="hidden" name="matchId" value={match.id} />}

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
              <Select
                items={ROUND_SELECT_LABELS}
                name={roundSelection === ROUND_CUSTOM ? undefined : "round"}
                value={roundSelection}
                onValueChange={(value) => value && setRoundSelection(value)}
              >
                <SelectTrigger id="round" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROUND_NONE}>Без раунду</SelectItem>
                  <SelectGroup>
                    <SelectLabel>Сітка (плей-офф)</SelectLabel>
                    {BRACKET_ROUND_PICKER_OPTIONS.map((round) => (
                      <SelectItem key={round} value={round}>
                        {round}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Матч за місце</SelectLabel>
                    {PLACEMENT_ROUNDS.filter((round) => round !== "Фінал").map((round) => (
                      <SelectItem key={round} value={round}>
                        {round}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectItem value={ROUND_CUSTOM}>Інше…</SelectItem>
                </SelectContent>
              </Select>
              {roundSelection === ROUND_CUSTOM && (
                <div className="flex flex-col gap-1">
                  <Input
                    name="round"
                    placeholder="Наприклад, Сіяні"
                    maxLength={100}
                    value={customRound}
                    onChange={(e) => setCustomRound(e.target.value)}
                    aria-label="Власна назва раунду"
                  />
                  <span className="self-end text-xs text-muted-foreground">
                    {customRound.length}/100
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduledDate">Дата (опційно)</Label>
              <Input
                id="scheduledDate"
                name="scheduledDate"
                type="date"
                defaultValue={toDateInputValue(match?.scheduledDate ?? null)}
              />
            </div>
          </div>

          {match && updateState.error && (
            <p className="text-sm text-destructive">{updateState.error}</p>
          )}

          <DialogFooter>
            {match ? (
              <SubmitButton label="Зберегти" />
            ) : (
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Збереження…" : "Створити матч"}
              </Button>
            )}
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
  roster: { id: string; name: string; nickname: string | null }[];
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
        const items = Object.fromEntries(available.map((player) => [player.id, fullDisplayName(player)]));

        return (
          <Select
            key={index}
            items={items}
            name={name}
            value={value}
            onValueChange={(next) => onChange(index, next ?? "")}
          >
            <SelectTrigger
              className="w-full"
              aria-label={count > 1 ? `${label}, гравець ${index + 1}` : label}
            >
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
