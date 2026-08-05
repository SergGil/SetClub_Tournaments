"use client";

import { useState, useTransition } from "react";
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRoleAction } from "@/lib/actions/users";

const ROLE_LABEL = { ADMIN: "Адмін", MEMBER: "Учасник" } as const;

export function UserRoleSelect({
  userId,
  userLabel,
  role,
  disabled,
}: {
  userId: string;
  userLabel: string;
  role: "ADMIN" | "MEMBER";
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // Only escalating MEMBER -> ADMIN goes through a confirm step - demoting
  // an admin reduces access, so there's nothing risky to double-check there.
  const [confirmOpen, setConfirmOpen] = useState(false);

  function applyRole(value: "ADMIN" | "MEMBER") {
    startTransition(async () => {
      try {
        await updateUserRoleAction(userId, value);
        toast.success(`Роль користувача «${userLabel}» змінено на «${ROLE_LABEL[value]}»`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не вдалося змінити роль");
      }
    });
  }

  return (
    <>
      <Select
        items={ROLE_LABEL}
        value={role}
        disabled={disabled || pending}
        onValueChange={(value) => {
          if (!value || value === role) return;
          if (value === "ADMIN") {
            setConfirmOpen(true);
            return;
          }
          applyRole(value);
        }}
      >
        <SelectTrigger
          className="w-32"
          aria-label="Роль користувача"
          title={disabled ? "Не можна змінити власну роль" : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((value) => (
            <SelectItem key={value} value={value}>
              {ROLE_LABEL[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Надати права адміністратора?</AlertDialogTitle>
            <AlertDialogDescription>
              «{userLabel}» отримає повний доступ до адмін-панелі: зможе створювати й видаляти
              турніри, матчі та гравців, а також змінювати ролі інших користувачів.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                applyRole("ADMIN");
              }}
            >
              Надати права адміна
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
