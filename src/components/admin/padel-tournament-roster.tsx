"use client";

import { XIcon } from "lucide-react";
import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addPadelParticipantAction,
  removePadelParticipantAction,
  setPadelParticipantGroupAction,
  togglePadelParticipantSeedAction,
  withdrawPadelParticipantAction,
} from "@/lib/actions/padel-tournaments";
import type { WithdrawActionState } from "@/lib/actions/padel-tournaments";
import { fullDisplayName } from "@/lib/player-display";
import { MATCH_FORMS, pluralizeUk } from "@/lib/pluralize";
import { groupRoundLabel, MAX_TOURNAMENT_GROUPS } from "@/lib/randomize-pairs";
import type { TournamentFormat } from "@/lib/validation/tournament";

type Participant = {
  playerId: string;
  seed: number | null;
  group: number | null;
  withdrawnAt: Date | null;
  player: { id: string; name: string; nickname: string | null };
};

/** Padel twin of tournament-roster.tsx. */
export function PadelTournamentRoster({
  tournamentId,
  format,
  participants,
  availablePlayers,
  scheduledMatchCountByPlayerId = {},
}: {
  tournamentId: string;
  format: TournamentFormat;
  participants: Participant[];
  availablePlayers: { id: string; name: string; nickname: string | null }[];
  scheduledMatchCountByPlayerId?: Record<string, number>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const [optimisticParticipants, addOptimisticParticipants] = useOptimistic(
    participants,
    (state, added: Participant[]) => [
      ...state,
      ...added.filter((a) => !state.some((s) => s.playerId === a.playerId)),
    ],
  );

  const optimisticRosterIds = new Set(optimisticParticipants.map((p) => p.playerId));
  const pickable = availablePlayers.filter((player) => !optimisticRosterIds.has(player.id));
  const selectedPlayers = pickable.filter((player) => selected.includes(player.id));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredPickable = normalizedSearch
    ? pickable.filter(
        (player) =>
          player.name.toLowerCase().includes(normalizedSearch) ||
          player.nickname?.toLowerCase().includes(normalizedSearch),
      )
    : pickable;

  function handleAdd() {
    const playersToAdd = selectedPlayers;
    if (playersToAdd.length === 0) return;
    const ids = playersToAdd.map((p) => p.id);
    startTransition(async () => {
      addOptimisticParticipants(
        playersToAdd.map((player) => ({
          playerId: player.id,
          seed: null,
          group: null,
          withdrawnAt: null,
          player,
        })),
      );
      const result = await addPadelParticipantAction(tournamentId, ids);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        setSelected([]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {pickable.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              multiple
              value={selected}
              onValueChange={(value) => setSelected(value ?? [])}
              onOpenChange={(open) => {
                if (!open) setSearch("");
              }}
            >
              <SelectTrigger className="w-full sm:w-56" aria-label="Обрати гравців">
                <SelectValue placeholder="Обрати гравців">
                  {(value: string[]) =>
                    value.length > 0 ? `Обрано гравців: ${value.length}` : "Обрати гравців"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                searchSlot={
                  <Input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Пошук…"
                    className="h-7"
                  />
                }
              >
                {filteredPickable.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {fullDisplayName(player)}
                  </SelectItem>
                ))}
                {filteredPickable.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Нічого не знайдено</p>
                )}
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleAdd} disabled={isPending || selected.length === 0}>
              {isPending
                ? "Додавання…"
                : selected.length > 1
                  ? `Додати всіх (${selected.length})`
                  : "Додати"}
            </Button>
          </div>

          {selectedPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedPlayers.map((player) => (
                <Badge key={player.id} variant="secondary" className="gap-1">
                  {fullDisplayName(player)}
                  <button
                    type="button"
                    onClick={() => setSelected((prev) => prev.filter((id) => id !== player.id))}
                    className="ml-0.5"
                  >
                    <XIcon className="size-3" />
                    <span className="sr-only">Прибрати з вибору</span>
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="flex flex-col gap-1">
        {optimisticParticipants.map((entry) => (
          <li
            key={entry.playerId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-1.5 break-words">
              {fullDisplayName(entry.player)}
              {entry.withdrawnAt != null && <Badge variant="warning">Знявся</Badge>}
            </span>
            <div className="flex items-center gap-3">
              {entry.withdrawnAt == null && (format === "SINGLES" || format === "DOUBLES") && (
                <GroupSelect
                  tournamentId={tournamentId}
                  playerId={entry.playerId}
                  group={entry.group}
                />
              )}
              {entry.withdrawnAt == null && (
                <SeedToggle
                  tournamentId={tournamentId}
                  playerId={entry.playerId}
                  seeded={entry.seed !== null}
                />
              )}
              {entry.withdrawnAt == null && format !== "DOUBLES" && (
                <WithdrawParticipantButton
                  tournamentId={tournamentId}
                  playerId={entry.playerId}
                  playerName={fullDisplayName(entry.player)}
                  scheduledMatchCount={scheduledMatchCountByPlayerId[entry.playerId] ?? 0}
                />
              )}
              <RemoveParticipantButton
                tournamentId={tournamentId}
                playerId={entry.playerId}
                playerName={fullDisplayName(entry.player)}
              />
            </div>
          </li>
        ))}
        {optimisticParticipants.length === 0 && (
          <p className="text-sm text-foreground/80">Ще немає жодного учасника.</p>
        )}
      </ul>
    </div>
  );
}

function RemoveParticipantButton({
  tournamentId,
  playerId,
  playerName,
}: {
  tournamentId: string;
  playerId: string;
  playerName: string;
}) {
  const [pending, startTransition] = useTransition();

  function confirmRemove() {
    startTransition(async () => {
      try {
        const result = await removePadelParticipantAction(tournamentId, playerId);
        if (result?.error) toast.error(result.error);
      } catch {
        toast.error("Не вдалося прибрати учасника");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" disabled={pending} />}>
        <XIcon />
        <span className="sr-only">Прибрати</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Прибрати учасника?</AlertDialogTitle>
          <AlertDialogDescription>
            «{playerName}» буде знято зі складу турніру.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={confirmRemove} disabled={pending}>
            {pending ? "Прибираємо…" : "Прибрати"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const WITHDRAW_INITIAL_STATE: WithdrawActionState = {};

const CASCADE_CONFIRM_WORD = "СКИНУТИ";

function WithdrawSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={disabled || pending}>
      {pending ? "Знімаємо…" : "Зняти з турніру"}
    </Button>
  );
}

function WithdrawParticipantButton({
  tournamentId,
  playerId,
  playerName,
  scheduledMatchCount,
}: {
  tournamentId: string;
  playerId: string;
  playerName: string;
  scheduledMatchCount: number;
}) {
  const [state, formAction] = useActionState(withdrawPadelParticipantAction, WITHDRAW_INITIAL_STATE);
  const [open, setOpen] = useState(false);
  const [cascadeConfirmText, setCascadeConfirmText] = useState("");
  const cascadeResets = state.cascadeResets ?? [];
  const cascadeConfirmed = cascadeConfirmText.trim().toUpperCase() === CASCADE_CONFIRM_WORD;

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setOpen(false);
  }
  useEffect(() => {
    if (state.success) toast.success("Гравця знято з турніру");
  }, [state]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCascadeConfirmText("");
      }}
    >
      <AlertDialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Зняти з турніру
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="playerId" value={playerId} />
          <input
            type="hidden"
            name="acknowledgedCascadeReset"
            value={cascadeConfirmed ? "true" : "false"}
          />
          <AlertDialogHeader>
            <AlertDialogTitle>Зняти «{playerName}» з турніру?</AlertDialogTitle>
            <AlertDialogDescription>
              {scheduledMatchCount > 0
                ? `${scheduledMatchCount} ${pluralizeUk(scheduledMatchCount, ["запланований", "заплановані", "запланованих"])} ${pluralizeUk(scheduledMatchCount, MATCH_FORMS)} автоматично ${pluralizeUk(scheduledMatchCount, ["закриється", "закриються", "закриються"])} технічною поразкою на користь суперників. `
                : ""}
              Учасник лишиться в турнірі (з позначкою «Знявся»), його вже зіграні матчі та
              рейтинг не зміняться.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cascadeResets.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Це зніме рахунок наступних матчів:</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {cascadeResets.map((r) => (
                  <li key={r.matchId}>
                    {r.round ? `${r.round}: ` : ""}
                    {r.sideALabel} – {r.sideBLabel}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${playerId}-withdraw-cascade-confirm`}>
                  Введіть <span className="font-semibold">{CASCADE_CONFIRM_WORD}</span>, щоб
                  підтвердити
                </Label>
                <Input
                  id={`${playerId}-withdraw-cascade-confirm`}
                  value={cascadeConfirmText}
                  onChange={(e) => setCascadeConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
          {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <WithdrawSubmitButton disabled={cascadeResets.length > 0 && !cascadeConfirmed} />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SeedToggle({
  tournamentId,
  playerId,
  seeded,
}: {
  tournamentId: string;
  playerId: string;
  seeded: boolean;
}) {
  const [, startTransition] = useTransition();
  const id = `padel-seed-${tournamentId}-${playerId}`;

  const [prevSeeded, setPrevSeeded] = useState(seeded);
  const [optimisticSeeded, setOptimisticSeeded] = useState(seeded);
  if (seeded !== prevSeeded) {
    setPrevSeeded(seeded);
    setOptimisticSeeded(seeded);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Checkbox
        id={id}
        checked={optimisticSeeded}
        onCheckedChange={(checked) => {
          setOptimisticSeeded(checked);
          startTransition(async () => {
            try {
              await togglePadelParticipantSeedAction(tournamentId, playerId, checked);
            } catch {
              setOptimisticSeeded(seeded);
              toast.error("Не вдалося змінити позначку сіяного гравця");
            }
          });
        }}
      />
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        Сіяний
      </Label>
    </div>
  );
}

const GROUP_NONE = "none";
const GROUP_VALUE_PREFIX = "group-";

const GROUP_SELECT_ITEMS: Record<string, string> = {
  [GROUP_NONE]: "Без групи",
  ...Object.fromEntries(
    Array.from({ length: MAX_TOURNAMENT_GROUPS }, (_, i) => [
      `${GROUP_VALUE_PREFIX}${i + 1}`,
      groupRoundLabel(i + 1),
    ]),
  ),
};

function GroupSelect({
  tournamentId,
  playerId,
  group,
}: {
  tournamentId: string;
  playerId: string;
  group: number | null;
}) {
  const [, startTransition] = useTransition();

  const [prevGroup, setPrevGroup] = useState(group);
  const [optimisticGroup, setOptimisticGroup] = useState(group);
  if (group !== prevGroup) {
    setPrevGroup(group);
    setOptimisticGroup(group);
  }

  return (
    <Select
      items={GROUP_SELECT_ITEMS}
      value={optimisticGroup === null ? GROUP_NONE : `${GROUP_VALUE_PREFIX}${optimisticGroup}`}
      onValueChange={(value) => {
        if (!value) return;
        const next = value === GROUP_NONE ? null : Number(value.slice(GROUP_VALUE_PREFIX.length));
        setOptimisticGroup(next);
        startTransition(async () => {
          try {
            const result = await setPadelParticipantGroupAction(tournamentId, playerId, next);
            if (result?.error) {
              setOptimisticGroup(group);
              toast.error(result.error);
            }
          } catch {
            setOptimisticGroup(group);
            toast.error("Не вдалося змінити групу гравця");
          }
        });
      }}
    >
      <SelectTrigger className="h-7 w-28 text-xs" aria-label="Група">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(GROUP_SELECT_ITEMS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
