"use client";

import { PlusIcon, TrophyIcon, XIcon } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { saveScoreAction } from "@/lib/actions/matches";
import type { ActionState } from "@/lib/actions/matches";
import { isTiebreakSet } from "@/lib/match-result";

type SetRow = { sideAGames: string; sideBGames: string; tiebreakA: string; tiebreakB: string };
type InitialSet = {
  sideAGames: number;
  sideBGames: number;
  tiebreakSideAPoints: number | null;
  tiebreakSideBPoints: number | null;
};

const initialState: ActionState = {};
const emptyRow: SetRow = { sideAGames: "", sideBGames: "", tiebreakA: "", tiebreakB: "" };

function toRows(sets: InitialSet[]): SetRow[] {
  return sets.length > 0
    ? sets.map((s) => ({
        sideAGames: String(s.sideAGames),
        sideBGames: String(s.sideBGames),
        tiebreakA: s.tiebreakSideAPoints != null ? String(s.tiebreakSideAPoints) : "",
        tiebreakB: s.tiebreakSideBPoints != null ? String(s.tiebreakSideBPoints) : "",
      }))
    : [emptyRow];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Збереження…" : "Зберегти рахунок"}
    </Button>
  );
}

export function ScoreDialog({
  matchId,
  tournamentId,
  sideALabel,
  sideBLabel,
  initialSets,
  initialUpdatedAt,
  initialRetired = false,
  initialWinnerSide = null,
  trigger,
}: {
  matchId: string;
  tournamentId: string;
  sideALabel: string;
  sideBLabel: string;
  initialSets: InitialSet[];
  /** The match's updatedAt when this dialog's data was loaded - lets the server detect a concurrent edit. */
  initialUpdatedAt: Date;
  initialRetired?: boolean;
  initialWinnerSide?: "A" | "B" | null;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SetRow[]>(() => toRows(initialSets));
  const [retired, setRetired] = useState(initialRetired);
  const [retiredWinner, setRetiredWinner] = useState<"A" | "B" | null>(
    initialRetired ? initialWinnerSide : null,
  );
  const [state, formAction] = useActionState(saveScoreAction, initialState);

  const setsJson = useMemo(() => {
    const cleaned = rows
      .filter((row) => row.sideAGames !== "" && row.sideBGames !== "")
      .map((row) => {
        const sideAGames = Number(row.sideAGames) || 0;
        const sideBGames = Number(row.sideBGames) || 0;
        const hasTiebreak =
          isTiebreakSet(sideAGames, sideBGames) && row.tiebreakA !== "" && row.tiebreakB !== "";
        return {
          sideAGames,
          sideBGames,
          ...(hasTiebreak
            ? {
                tiebreakSideAPoints: Number(row.tiebreakA) || 0,
                tiebreakSideBPoints: Number(row.tiebreakB) || 0,
              }
            : {}),
        };
      });
    return JSON.stringify(cleaned);
  }, [rows]);

  // Adjusts state during render (react.dev's "storing information from
  // previous renders" pattern - a useState setter call here is fine, unlike
  // mutating a ref during render or calling setState inside an effect,
  // both of which this project's stricter Compiler-aware lint rules
  // reject). Deliberately NOT gated on `open`: a save that resolves after
  // the admin already closed the dialog must still mark `state` as handled
  // here, or the *next* time the same dialog is reopened, this would see
  // that same already-resolved `state` as new and immediately close it again.
  const [handledState, setHandledState] = useState(state);
  if (state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }
  const fieldErrors = state.fieldErrors ?? {};

  function updateRow(index: number, field: keyof SetRow, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Discard any draft left over from a previous cancelled edit.
          setRows(toRows(initialSets));
          setRetired(initialRetired);
          setRetiredWinner(initialRetired ? initialWinnerSide : null);
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form
          action={formAction}
          className="flex flex-col gap-4"
          onKeyDown={(e) => {
            // Pressing Enter while filling in a game/tiebreak count would
            // otherwise submit the form mid-entry, before the other field of
            // the set has been filled in.
            if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Рахунок матчу</DialogTitle>
          </DialogHeader>

          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="expectedUpdatedAt" value={initialUpdatedAt.toISOString()} />
          <input type="hidden" name="setsJson" value={setsJson} />
          <input type="hidden" name="retired" value={retired ? "true" : "false"} />
          <input type="hidden" name="retiredWinnerSide" value={retiredWinner ?? ""} />

          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-sm">
            <span />
            <span className="text-center font-medium">{sideALabel}</span>
            <span className="text-center font-medium">{sideBLabel}</span>
            <span />
            {rows.map((row, index) => {
              const sideAGames = Number(row.sideAGames) || 0;
              const sideBGames = Number(row.sideBGames) || 0;
              const rowIsTiebreak = isTiebreakSet(sideAGames, sideBGames);
              // Zod attaches a score/tiebreak issue for this set to
              // sideAGames/tiebreakSideAPoints regardless of which side is
              // actually at fault, so both inputs of the pair are marked
              // together rather than guessing which one to blame.
              const scoreError = fieldErrors[`sets.${index}.sideAGames`];
              const tiebreakError = fieldErrors[`sets.${index}.tiebreakSideAPoints`];
              const rowError = scoreError ?? tiebreakError;
              return (
                <div key={index} className="contents">
                  <span className="text-muted-foreground">Сет {index + 1}</span>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    className="w-16 text-center"
                    value={row.sideAGames}
                    onChange={(e) => updateRow(index, "sideAGames", e.target.value)}
                    aria-label={`Сет ${index + 1}, ${sideALabel}`}
                    aria-invalid={Boolean(scoreError)}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    className="w-16 text-center"
                    value={row.sideBGames}
                    onChange={(e) => updateRow(index, "sideBGames", e.target.value)}
                    aria-label={`Сет ${index + 1}, ${sideBLabel}`}
                    aria-invalid={Boolean(scoreError)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                    disabled={rows.length === 1}
                  >
                    <XIcon />
                    <span className="sr-only">Прибрати сет {index + 1}</span>
                  </Button>
                  {rowIsTiebreak && (
                    <div className="col-span-4 flex items-center gap-2 pl-4">
                      <span className="text-xs text-muted-foreground">Тайбрейк:</span>
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        className="w-14 px-1 text-center"
                        value={row.tiebreakA}
                        onChange={(e) => updateRow(index, "tiebreakA", e.target.value)}
                        aria-label={`Тайбрейк сету ${index + 1}, ${sideALabel}`}
                        aria-invalid={Boolean(tiebreakError)}
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        className="w-14 px-1 text-center"
                        value={row.tiebreakB}
                        onChange={(e) => updateRow(index, "tiebreakB", e.target.value)}
                        aria-label={`Тайбрейк сету ${index + 1}, ${sideBLabel}`}
                        aria-invalid={Boolean(tiebreakError)}
                      />
                    </div>
                  )}
                  {rowError && <p className="col-span-4 text-xs text-destructive">{rowError}</p>}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {rows.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRows((prev) => [...prev, emptyRow])}
              >
                <PlusIcon /> Додати сет
              </Button>
            )}
            {(rows.some((row) => row.sideAGames !== "" || row.sideBGames !== "") || retired) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRows([emptyRow]);
                  setRetired(false);
                  setRetiredWinner(null);
                }}
              >
                <XIcon /> Скинути рахунок
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Checkbox
                id={`${matchId}-retired`}
                checked={retired}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setRetired(next);
                  if (!next) setRetiredWinner(null);
                }}
              />
              <Label htmlFor={`${matchId}-retired`} className="text-sm font-normal">
                Матч завершено зняттям гравця (рахунок може бути неповним)
              </Label>
            </div>

            {retired && (
              <div className="flex flex-col gap-1.5 pl-6 text-sm">
                <span className="text-muted-foreground" id="retired-winner-label">
                  Переможець:
                </span>
                <div role="group" aria-labelledby="retired-winner-label" className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-auto max-w-full min-w-0 justify-start py-1.5 text-left whitespace-normal"
                    variant={retiredWinner === "A" ? "default" : "outline"}
                    aria-pressed={retiredWinner === "A"}
                    onClick={() => setRetiredWinner("A")}
                  >
                    {sideALabel || "Сторона A"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-auto max-w-full min-w-0 justify-start py-1.5 text-left whitespace-normal"
                    variant={retiredWinner === "B" ? "default" : "outline"}
                    aria-pressed={retiredWinner === "B"}
                    onClick={() => setRetiredWinner("B")}
                  >
                    {sideBLabel || "Сторона B"}
                  </Button>
                </div>
                {fieldErrors.retiredWinnerSide && (
                  <p className="text-xs text-destructive">{fieldErrors.retiredWinnerSide}</p>
                )}
              </div>
            )}
          </div>

          {state.error && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <TrophyIcon className="size-4" /> {state.error}
            </p>
          )}

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
