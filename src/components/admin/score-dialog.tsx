"use client";

import { PlusIcon, TrophyIcon, XIcon } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
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
import { saveScoreAction } from "@/lib/actions/matches";
import type { ActionState } from "@/lib/actions/matches";

type SetRow = { sideAGames: string; sideBGames: string };

const initialState: ActionState = {};

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
  trigger,
}: {
  matchId: string;
  tournamentId: string;
  sideALabel: string;
  sideBLabel: string;
  initialSets: { sideAGames: number; sideBGames: number }[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SetRow[]>(() =>
    initialSets.length > 0
      ? initialSets.map((s) => ({ sideAGames: String(s.sideAGames), sideBGames: String(s.sideBGames) }))
      : [{ sideAGames: "", sideBGames: "" }],
  );
  const [state, formAction] = useActionState(saveScoreAction, initialState);

  const setsJson = useMemo(() => {
    const cleaned = rows
      .filter((row) => row.sideAGames !== "" || row.sideBGames !== "")
      .map((row) => ({
        sideAGames: Number(row.sideAGames) || 0,
        sideBGames: Number(row.sideBGames) || 0,
      }));
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
          setRows(
            initialSets.length > 0
              ? initialSets.map((s) => ({
                  sideAGames: String(s.sideAGames),
                  sideBGames: String(s.sideBGames),
                }))
              : [{ sideAGames: "", sideBGames: "" }],
          );
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

          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-sm">
            <span />
            <span className="text-center font-medium">{sideALabel}</span>
            <span className="text-center font-medium">{sideBLabel}</span>
            <span />
            {rows.map((row, index) => (
              <div key={index} className="contents">
                <span className="text-muted-foreground">Сет {index + 1}</span>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  className="w-16 text-center"
                  value={row.sideAGames}
                  onChange={(e) => updateRow(index, "sideAGames", e.target.value)}
                />
                <Input
                  type="number"
                  min={0}
                  max={99}
                  className="w-16 text-center"
                  value={row.sideBGames}
                  onChange={(e) => updateRow(index, "sideBGames", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  disabled={rows.length === 1}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
          </div>

          {rows.length < 5 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setRows((prev) => [...prev, { sideAGames: "", sideBGames: "" }])}
            >
              <PlusIcon /> Додати сет
            </Button>
          )}

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
