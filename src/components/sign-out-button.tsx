"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";

export function SignOutButton() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>Вийти</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Вийти з акаунту?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={() => signOutAction()}>Вийти</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
