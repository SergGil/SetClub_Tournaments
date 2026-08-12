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

const ROLE_LABEL = { SUPERADMIN: "Суперадмін", ADMIN: "Адмін", MEMBER: "Учасник" } as const;
type RoleValue = keyof typeof ROLE_LABEL;

export function UserRoleSelect({
  userId,
  userLabel,
  role,
  disabled,
  disabledReason,
}: {
  userId: string;
  userLabel: string;
  role: RoleValue;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [pending, startTransition] = useTransition();
  // Only escalating to SUPERADMIN goes through a confirm step - that's the
  // one change with real teeth (full access everywhere, incl. managing other
  // people's roles). ADMIN alone does nothing until domains are granted too
  // (see UserDomainsEditor), and demotions only reduce access either way.
  const [confirmOpen, setConfirmOpen] = useState(false);

  function applyRole(value: RoleValue) {
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
          if (value === "SUPERADMIN") {
            setConfirmOpen(true);
            return;
          }
          applyRole(value as RoleValue);
        }}
      >
        <SelectTrigger
          className="w-36"
          aria-label="Роль користувача"
          title={disabled ? (disabledReason ?? "Не можна змінити власну роль") : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(ROLE_LABEL) as RoleValue[]).map((value) => (
            <SelectItem key={value} value={value}>
              {ROLE_LABEL[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Надати права суперадміністратора?</AlertDialogTitle>
            <AlertDialogDescription>
              «{userLabel}» отримає повний доступ до адмін-панелі всіх напрямків: зможе керувати
              турнірами, кав&apos;ярнею й паделом одразу, призначати адмін-розділи іншим
              користувачам і змінювати будь-чию роль.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                applyRole("SUPERADMIN");
              }}
            >
              Надати права суперадміна
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
