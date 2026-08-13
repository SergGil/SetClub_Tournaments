"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { RequiredMark } from "@/components/admin/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPadelTournamentAction, updatePadelTournamentAction } from "@/lib/actions/padel-tournaments";
import type { ActionState } from "@/lib/actions/padel-tournaments";
import {
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  tournamentFormatValues,
  tournamentStatusValues,
} from "@/lib/validation/tournament";

function toDateInputValue(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Збереження…" : label}
    </Button>
  );
}

type PadelTournamentFormProps = {
  tournament?: {
    id: string;
    name: string;
    description: string | null;
    format: (typeof tournamentFormatValues)[number];
    status: (typeof tournamentStatusValues)[number];
    startDate: Date | string;
    endDate: Date | string;
    _count: { matches: number };
  };
};

const initialState: ActionState = {};

/** Padel twin of tournament-form.tsx - no "Покриття" (surface) field, Padel tournaments have no CourtSurface. */
export function PadelTournamentForm({ tournament }: PadelTournamentFormProps) {
  const action = tournament ? updatePadelTournamentAction : createPadelTournamentAction;
  const [state, formAction] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const formatLocked = Boolean(tournament && tournament._count.matches > 0);
  const [nameLength, setNameLength] = useState(tournament?.name.length ?? 0);
  const [descriptionLength, setDescriptionLength] = useState(tournament?.description?.length ?? 0);

  return (
    <form
      action={formAction}
      className="flex max-w-lg flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6"
    >
      {tournament && <input type="hidden" name="id" value={tournament.id} />}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="name">
            Назва турніру
            <RequiredMark />
          </Label>
          <span className="text-xs text-muted-foreground">{nameLength}/150</span>
        </div>
        <Input
          id="name"
          name="name"
          defaultValue={tournament?.name}
          required
          maxLength={150}
          onChange={(e) => setNameLength(e.target.value.length)}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
        />
        {fieldErrors.name && (
          <p id="name-error" className="text-sm text-destructive">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="description">Опис (опційно)</Label>
          <span className="text-xs text-muted-foreground">{descriptionLength}/2000</span>
        </div>
        <Textarea
          id="description"
          name="description"
          defaultValue={tournament?.description ?? ""}
          rows={3}
          maxLength={2000}
          onChange={(e) => setDescriptionLength(e.target.value.length)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="startDate">
            Дата початку
            <RequiredMark />
          </Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={tournament ? toDateInputValue(tournament.startDate) : undefined}
            required
            aria-invalid={Boolean(fieldErrors.startDate)}
            aria-describedby={fieldErrors.startDate ? "startDate-error" : undefined}
          />
          {fieldErrors.startDate && (
            <p id="startDate-error" className="text-sm text-destructive">
              {fieldErrors.startDate}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="endDate">
            Дата завершення
            <RequiredMark />
          </Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={tournament ? toDateInputValue(tournament.endDate) : undefined}
            required
            aria-invalid={Boolean(fieldErrors.endDate)}
            aria-describedby={fieldErrors.endDate ? "endDate-error" : undefined}
          />
          {fieldErrors.endDate && (
            <p id="endDate-error" className="text-sm text-destructive">
              {fieldErrors.endDate}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="format">Формат</Label>
          {formatLocked && tournament && (
            <input type="hidden" name="format" value={tournament.format} />
          )}
          <Select
            items={TOURNAMENT_FORMAT_LABEL}
            name={formatLocked ? undefined : "format"}
            defaultValue={tournament?.format ?? "SINGLES"}
            disabled={formatLocked}
          >
            <SelectTrigger
              id="format"
              className="w-full"
              title={formatLocked ? "У турнірі вже є матчі — спершу видаліть їх, щоб змінити формат" : undefined}
              aria-invalid={Boolean(fieldErrors.format)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tournamentFormatValues.map((value) => (
                <SelectItem key={value} value={value}>
                  {TOURNAMENT_FORMAT_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formatLocked && (
            <p className="text-xs text-muted-foreground">
              У турнірі вже є матчі — спершу видаліть їх, щоб змінити формат.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Статус</Label>
          <Select items={TOURNAMENT_STATUS_LABEL} name="status" defaultValue={tournament?.status ?? "UPCOMING"}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tournamentStatusValues.map((value) => (
                <SelectItem key={value} value={value}>
                  {TOURNAMENT_STATUS_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <SubmitButton label={tournament ? "Зберегти зміни" : "Створити турнір"} />
      </div>
    </form>
  );
}
