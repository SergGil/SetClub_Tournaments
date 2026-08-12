"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateUserDomainsAction } from "@/lib/actions/users";
import { cn } from "@/lib/utils";
import type { AdminDomain } from "@/generated/prisma/enums";

const DOMAIN_OPTIONS: { value: AdminDomain; label: string }[] = [
  { value: "TENNIS", label: "Теніс" },
  { value: "COFFEE", label: "Кава" },
  { value: "PADEL", label: "Падел" },
];

export function UserDomainsEditor({
  userId,
  userLabel,
  domains,
}: {
  userId: string;
  userLabel: string;
  domains: AdminDomain[];
}) {
  const [pending, startTransition] = useTransition();

  function toggle(domain: AdminDomain) {
    const next = domains.includes(domain)
      ? domains.filter((d) => d !== domain)
      : [...domains, domain];

    startTransition(async () => {
      try {
        await updateUserDomainsAction(userId, next);
        toast.success(`Адмін-розділи «${userLabel}» оновлено`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не вдалося змінити розділи");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {DOMAIN_OPTIONS.map((option) => {
        const active = domains.includes(option.value);
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            disabled={pending}
            aria-pressed={active}
            className={cn("h-7 px-2.5 text-xs", !active && "text-muted-foreground")}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
