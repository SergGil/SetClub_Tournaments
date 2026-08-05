"use client";

import { XIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDIT_ACTION_LABEL, type AuditAction } from "@/lib/audit-actions";

const ALL = "ALL";

export function AuditFilters({
  actors,
  selectedActor,
  selectedAction,
}: {
  actors: string[];
  selectedActor?: string;
  selectedAction?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const actorItems = {
    [ALL]: "Усі автори",
    ...Object.fromEntries(actors.map((actor) => [actor, actor])),
  };
  const actionItems: Record<string, string> = { [ALL]: "Усі дії", ...AUDIT_ACTION_LABEL };

  function pushFilters(next: { actor?: string; action?: string }) {
    const params = new URLSearchParams();
    if (next.actor) params.set("actor", next.actor);
    if (next.action) params.set("action", next.action);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilter = Boolean(selectedActor || selectedAction);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={actorItems}
        value={selectedActor ?? ALL}
        onValueChange={(value) =>
          pushFilters({ actor: value && value !== ALL ? value : undefined, action: selectedAction })
        }
      >
        <SelectTrigger className="w-full sm:w-56" aria-label="Фільтр за автором">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Усі автори</SelectItem>
          {actors.map((actor) => (
            <SelectItem key={actor} value={actor}>
              {actor}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={actionItems}
        value={selectedAction ?? ALL}
        onValueChange={(value) =>
          pushFilters({ actor: selectedActor, action: value && value !== ALL ? value : undefined })
        }
      >
        <SelectTrigger className="w-full sm:w-56" aria-label="Фільтр за типом дії">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Усі дії</SelectItem>
          {(Object.keys(AUDIT_ACTION_LABEL) as AuditAction[]).map((action) => (
            <SelectItem key={action} value={action}>
              {AUDIT_ACTION_LABEL[action]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilter && (
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <XIcon /> Скинути фільтри
        </Button>
      )}
    </div>
  );
}
