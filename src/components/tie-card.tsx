"use client";

import { XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { RubberDialog } from "@/components/admin/rubber-dialog";
import { MatchSummary } from "@/components/match-summary";
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
import { Button } from "@/components/ui/button";
import { deleteTieAction } from "@/lib/actions/ties";
import type { MatchWithDetails } from "@/lib/queries/matches";

type TeamInfo = { id: string; name: string; members: { id: string; name: string; nickname: string | null }[] };

function DeleteTieButton({ tournamentId, tieId, label }: { tournamentId: string; tieId: string; label: string }) {
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteTieAction(tournamentId, tieId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" disabled={pending} />}>
        <XIcon />
        <span className="sr-only">Видалити зустріч «{label}»</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити зустріч «{label}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Раббери цієї зустрічі не видаляються — вони лишаться звичайними матчами турніру
            (побачите їх серед матчів турніру).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete} disabled={pending}>
            {pending ? "Видалення…" : "Видалити"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * One Davis-Cup-style tie: two teams, a live rubber tally, and the rubbers
 * themselves rendered via the existing MatchSummary - see
 * docs/TOURNAMENT_TEAMS.md. Shared between the admin tab and the public
 * tournament page (`canManage` gates the create-rubber/delete-tie
 * affordances), same pattern as TournamentGallery's own canManage prop.
 */
export function TieCard({
  tournamentId,
  tieId,
  label,
  teamA,
  teamB,
  rubbers,
  canManage = false,
}: {
  tournamentId: string;
  tieId: string;
  label: string | null;
  teamA: TeamInfo;
  teamB: TeamInfo;
  rubbers: MatchWithDetails[];
  canManage?: boolean;
}) {
  const teamAWins = rubbers.filter((r) => r.status === "COMPLETED" && r.winnerSide === "A").length;
  const teamBWins = rubbers.filter((r) => r.status === "COMPLETED" && r.winnerSide === "B").length;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          <span className="text-base font-semibold">
            {teamA.name}{" "}
            <span className="tabular-nums text-foreground/70">
              {teamAWins} — {teamBWins}
            </span>{" "}
            {teamB.name}
          </span>
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            <RubberDialog
              tieId={tieId}
              teamAName={teamA.name}
              teamBName={teamB.name}
              teamAMembers={teamA.members}
              teamBMembers={teamB.members}
            />
            <DeleteTieButton tournamentId={tournamentId} tieId={tieId} label={label ?? `${teamA.name} — ${teamB.name}`} />
          </div>
        )}
      </div>
      {rubbers.length === 0 ? (
        <p className="text-sm text-foreground/80">Рабберів ще не додано.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rubbers.map((rubber) => (
            <MatchSummary key={rubber.id} match={rubber} showTournament={false} hideRound />
          ))}
        </div>
      )}
    </div>
  );
}
