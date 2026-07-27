"use client";

import { useTransition } from "react";
import { toast } from "sonner";

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
  role,
  disabled,
}: {
  userId: string;
  role: "ADMIN" | "MEMBER";
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={role}
      disabled={disabled || pending}
      onValueChange={(value) => {
        if (!value || value === role) return;
        startTransition(async () => {
          try {
            await updateUserRoleAction(userId, value);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Не вдалося змінити роль");
          }
        });
      }}
    >
      <SelectTrigger className="w-32">
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
  );
}
