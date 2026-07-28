"use client";

import { useState } from "react";
import { toast } from "sonner";

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

function isRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof (error as { digest?: string }).digest === "string" &&
    (error as { digest?: string }).digest!.startsWith("NEXT_REDIRECT")
  );
}

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await signOutAction();
    } catch (error) {
      // signOutAction redirects on success, which Next.js implements by
      // throwing a special "NEXT_REDIRECT" error - let that propagate so
      // the navigation still happens; only a genuine failure gets a toast.
      if (isRedirectError(error)) throw error;
      setPending(false);
      toast.error("Не вдалося вийти з акаунту");
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>Вийти</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Вийти з акаунту?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={handleSignOut} disabled={pending}>
            {pending ? "Вихід…" : "Вийти"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
