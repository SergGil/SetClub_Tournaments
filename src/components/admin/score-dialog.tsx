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

type SetRow = { sideAGames: string; sideBGames: string; tiebreak: string };
type InitialSet = { sideAGames: number; sideBGames: number; tiebreakLoserPoints: number | null };

const initialState: ActionState = {};

function toRows(sets: InitialSet[]): SetRow[] {
  return sets.length > 0
    ? sets.map((s) => ({
        sideAGames: String(s.sideAGames),
        sideBGames: String(s.sideBGames),
        tiebreak: s.tiebreakLoserPoints != null ? String(s.tiebreakLoserPoints) : "",
      }))
    : [{ sideAGames: "", sideBGames: "", tiebreak: "" }];
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
  initialRetired = false,
  initialWinnerSide = null,
  trigger,
}: {
  matchId: string;
  tournamentId: string;
  sideALabel: string;
  sideBLabel: string;
  initialSets: InitialSet[];
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
      .filter((row) => row.sideAGames !== "" || row.sideBGames !== "")
      .map((row) => {
        const sideAGames = Number(row.sideAGames) || 0;
        const sideBGames = Number(row.sideBGames) || 0;
        const tiebreakLoserPoints =
          isTiebreakSet(sideAGames, sideBGames) && row.tiebreak !== ""
            ? Number(row.tiebreak) || 0
            : undefined;
        return {
          sideAGames,
          sideBGames,
          ...(tiebreakLoserPoints !== undefined ? { tiebreakLoserPoints } : {}),
        };
      });
    return JSON.stringify(cleaned);
  }, [rows]);

  const [handledState, setHandledState] = useState(state);
  if (open && state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

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
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Рахунок матчу</DialogTitle>
          </DialogHeader>

          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="setsJson" value={setsJson} />
          <input type="hidden" name="retired" value={retired ? "true" : "false"} />
          <input type="hidden" name="retiredWinnerSide" value={retiredWinner ?? ""} />

          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 text-sm">
            <span />
            <span className="text-center font-medium">{sideALabel}</span>
            <span className="text-center font-medium">{sideBLabel}</span>
            <span />
            <span />
            {rows.map((row, index) => {
              const sideAGames = Number(row.sideAGames) || 0;
              const sideBGames = Number(row.sideBGames) || 0;
              const rowIsTiebreak = isTiebreakSet(sideAGames, sideBGames);
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
                  />
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    className="w-16 text-center"
                    value={row.sideBGames}
                    onChange={(e) => updateRow(index, "sideBGames", e.target.value)}
                    aria-label={`Сет ${index + 1}, ${sideBLabel}`}
                  />
                  <div className="flex justify-center">
                    {rowIsTiebreak && (
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        placeholder="тайбр."
                        className="w-16 text-center"
                        value={row.tiebreak}
                        onChange={(e) => updateRow(index, "tiebreak", e.target.value)}
                        aria-label={`Рахунок тайбрейку сету ${index + 1} (очки програвшого)`}
                      />
                    )}
                  </div>
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
                </div>
              );
            })}
          </div>

          {rows.length < 5 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setRows((prev) => [...prev, { sideAGames: "", sideBGames: "", tiebreak: "" }])}
            >
              <PlusIcon /> Додати сет
            </Button>
          )}

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
              <div className="flex items-center gap-2 pl-6 text-sm">
                <span className="text-muted-foreground">Переможець:</span>
                <Button
                  type="button"
                  size="sm"
                  variant={retiredWinner === "A" ? "default" : "outline"}
                  onClick={() => setRetiredWinner("A")}
                >
                  {sideALabel || "Сторона A"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={retiredWinner === "B" ? "default" : "outline"}
                  onClick={() => setRetiredWinner("B")}
                >
                  {sideBLabel || "Сторона B"}
                </Button>
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
