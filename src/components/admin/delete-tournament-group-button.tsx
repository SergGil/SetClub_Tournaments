"use client";

import { XIcon } from "lucide-react";
import { useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { deleteTournamentGroupAction } from "@/lib/actions/tournaments";

/** Delete affordance for a custom "Додаткові групи" heading (see createTournamentGroupAction) - admin-only, rendered via TournamentStandingsSection's renderGroupHeaderExtra slot. */
export function DeleteTournamentGroupButton({
  tournamentId,
  groupId,
  groupName,
}: {
  tournamentId: string;
  groupId: string;
  groupName: string;
}) {
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteTournamentGroupAction(tournamentId, groupId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button type="button" variant="ghost" size="icon-sm" disabled={pending} />}
      >
        <XIcon />
        <span className="sr-only">Видалити групу «{groupName}»</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити групу «{groupName}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Групу буде видалено разом з усім її складом. Це не впливає на статистику гравців за
            межами цієї групи - вбудовані групи (A-F) і всі матчі лишаються без змін.
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
