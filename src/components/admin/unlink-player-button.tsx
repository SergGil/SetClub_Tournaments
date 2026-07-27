"use client";

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
import { unlinkPlayerAction } from "@/lib/actions/players";

export function UnlinkPlayerButton({ playerId, name }: { playerId: string; name: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
        Відв&apos;язати
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Відв&apos;язати акаунт від гравця {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Гравець стане заглушкою без акаунту. Google-акаунт зможе прив&apos;язатись знову
            автоматично (якщо email збігається) або вручну через адмінку.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => unlinkPlayerAction(playerId)}>
            Відв&apos;язати
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
