"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTieAction } from "@/lib/actions/ties";

/** Manual "pick two teams" tie creation - see docs/TOURNAMENT_TEAMS.md for why v1 has no auto-generated round robin of ties. */
export function CreateTieDialog({
  tournamentId,
  teams,
}: {
  tournamentId: string;
  teams: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setTeamAId("");
    setTeamBId("");
    setLabel("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTieAction(tournamentId, teamAId, teamBId, label);
      if (result?.error) {
        toast.error(result.error);
      } else {
        setOpen(false);
        reset();
      }
    });
  }

  const teamAItems = Object.fromEntries(teams.filter((t) => t.id !== teamBId).map((t) => [t.id, t.name]));
  const teamBItems = Object.fromEntries(teams.filter((t) => t.id !== teamAId).map((t) => [t.id, t.name]));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={teams.length < 2} />}>
        <PlusIcon /> Створити зустріч
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Створити зустріч</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>Команда А</Label>
            <Select items={teamAItems} value={teamAId} onValueChange={(v) => setTeamAId(v ?? "")}>
              <SelectTrigger className="w-full" aria-label="Обрати команду А">
                <SelectValue placeholder="Оберіть команду" />
              </SelectTrigger>
              <SelectContent>
                {teams
                  .filter((t) => t.id !== teamBId)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Команда Б</Label>
            <Select items={teamBItems} value={teamBId} onValueChange={(v) => setTeamBId(v ?? "")}>
              <SelectTrigger className="w-full" aria-label="Обрати команду Б">
                <SelectValue placeholder="Оберіть команду" />
              </SelectTrigger>
              <SelectContent>
                {teams
                  .filter((t) => t.id !== teamAId)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tie-label">Мітка (опційно)</Label>
            <Input
              id="tie-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Наприклад, Тур 1"
              maxLength={100}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !teamAId || !teamBId || teamAId === teamBId}>
              {pending ? "Створення…" : "Створити"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
