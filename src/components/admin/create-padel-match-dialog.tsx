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
import { createPadelMatchAction, updatePadelMatchAction } from "@/lib/actions/padel-matches";
import type { ActionState } from "@/lib/actions/padel-matches";
import { fullDisplayName } from "@/lib/player-display";
import {
  BRACKET_ROUND_PICKER_OPTIONS,
  BRACKET_ROUNDS,
  CONSOLATION_SEMIFINAL_ROUND,
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
  [CONSOLATION_SEMIFINAL_ROUND]: CONSOLATION_SEMIFINAL_ROUND,
  ...Object.fromEntries(PLACEMENT_ROUNDS.filter((r) => r !== "Фінал").map((r) => [r, r])),
  [ROUND_CUSTOM]: "Інше…",
};

function deriveRoundSelection(
  round: string | null,
  customGroupNames: string[],
): { selection: string; customValue: string } {
  if (!round) return { selection: ROUND_NONE, customValue: "" };
  if (isPlayoffRound(round) || customGroupNames.includes(round)) {
    return { selection: round, customValue: "" };
  }
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

type PadelMatchDialogProps = {
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
  onOptimisticCreate?: (input: CreateInput) => void;
  customGroupNames?: string[];
};

/** Padel twin of create-match-dialog.tsx's MatchDialog. */
export function PadelMatchDialog({
  trigger,
  tournamentId,
  format,
  roster,
  match,
  onOptimisticCreate,
  customGroupNames = [],
}: PadelMatchDialogProps) {
  const extraRoundOptions = Array.from(new Set(customGroupNames.filter((name) => !isPlayoffRound(name))));
  const roundItemLabels: Record<string, string> = {
    ...ROUND_SELECT_LABELS,
    ...Object.fromEntries(extraRoundOptions.map((name) => [name, name])),
  };
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
    () => deriveRoundSelection(match?.round ?? null, customGroupNames).selection,
  );
  const [customRound, setCustomRound] = useState(
    () => deriveRoundSelection(match?.round ?? null, customGroupNames).customValue,
  );

  function resetDraft() {
    setSideA(EMPTY_SLOTS);
    setSideB(EMPTY_SLOTS);
  }

  const [updateState, updateFormAction] = useActionState(updatePadelMatchAction, initialState);
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

  const [isCreating, startCreateTransition] = useTransition();

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = readCreateInput(formData, matchType);

    setOpen(false);
    resetDraft();

    startCreateTransition(async () => {
      onOptimisticCreate?.(input);
      const result = await createPadelMatchAction(initialState, formData);
      if (result.error) {
        toast.error(result.error);
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
          setMatchType(match?.matchType ?? options[0]);
          setSideA(match ? [...match.sideAPlayerIds, ...EMPTY_SLOTS].slice(0, 2) : EMPTY_SLOTS);
          setSideB(match ? [...match.sideBPlayerIds, ...EMPTY_SLOTS].slice(0, 2) : EMPTY_SLOTS);
          const derivedRound = deriveRoundSelection(match?.round ?? null, customGroupNames);
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
                items={roundItemLabels}
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
                  {extraRoundOptions.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Додаткові групи</SelectLabel>
                      {extraRoundOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
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
