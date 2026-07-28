"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

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
import { createTournamentAction, updateTournamentAction } from "@/lib/actions/tournaments";
import type { ActionState } from "@/lib/actions/tournaments";
import {
  COURT_SURFACE_LABEL,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  courtSurfaceValues,
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

type TournamentFormProps = {
  tournament?: {
    id: string;
    name: string;
    description: string | null;
    format: (typeof tournamentFormatValues)[number];
    status: (typeof tournamentStatusValues)[number];
    surface: (typeof courtSurfaceValues)[number];
    startDate: Date | string;
    endDate: Date | string;
  };
};

const initialState: ActionState = {};

export function TournamentForm({ tournament }: TournamentFormProps) {
  const action = tournament ? updateTournamentAction : createTournamentAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {tournament && <input type="hidden" name="id" value={tournament.id} />}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Назва турніру</Label>
        <Input id="name" name="name" defaultValue={tournament?.name} required maxLength={150} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Опис (опційно)</Label>
        <Textarea id="description" name="description" defaultValue={tournament?.description ?? ""} rows={3} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="startDate">Дата початку</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={tournament ? toDateInputValue(tournament.startDate) : undefined}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="endDate">Дата завершення</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={tournament ? toDateInputValue(tournament.endDate) : undefined}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="format">Формат</Label>
          <Select items={TOURNAMENT_FORMAT_LABEL} name="format" defaultValue={tournament?.format ?? "SINGLES"}>
            <SelectTrigger id="format" className="w-full">
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="surface">Покриття</Label>
          <Select items={COURT_SURFACE_LABEL} name="surface" defaultValue={tournament?.surface ?? "HARD"}>
            <SelectTrigger id="surface" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courtSurfaceValues.map((value) => (
                <SelectItem key={value} value={value}>
                  {COURT_SURFACE_LABEL[value]}
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
