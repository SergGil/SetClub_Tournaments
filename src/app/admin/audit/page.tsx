import { redirect } from "next/navigation";

import { AuditFilters } from "@/components/admin/audit-filters";
import { AuditLogTable, type AuditLogRow } from "@/components/admin/audit-log-table";
import { LoadMore } from "@/components/load-more";
import { AUDIT_ACTION_LABEL, AUDIT_ACTIONS, type AuditAction } from "@/lib/audit";
import { formatDateTimeKyiv } from "@/lib/date-format";
import { parseShowParam } from "@/lib/load-more";
import { isAdmin } from "@/lib/permissions";
import { getAuditLogPage, getDistinctAuditActors } from "@/lib/queries/audit";

export const metadata = { title: "Журнал дій" };

const PAGE_SIZE = 20;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; actor?: string; action?: string }>;
}) {
  // The full audit log spans every domain - superadmin only, same as /admin/users.
  if (!(await isAdmin())) {
    redirect("/admin");
  }

  const { show: showParam, actor: actorParam, action: actionParam } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const action = (AUDIT_ACTIONS as readonly string[]).includes(actionParam ?? "")
    ? (actionParam as AuditAction)
    : undefined;
  // Actor options come from the log itself (see getDistinctAuditActors), so
  // fetch that list first and validate the URL param against it before
  // querying entries - an unrecognized ?actor= is treated as no filter
  // rather than silently matching zero rows.
  const actors = await getDistinctAuditActors();
  const actor = actorParam && actors.includes(actorParam) ? actorParam : undefined;
  const { entries, total } = await getAuditLogPage(shown, { actorLabel: actor, action });
  const rows: AuditLogRow[] = entries.map((entry) => ({
    id: entry.id,
    createdAtLabel: formatDateTimeKyiv(entry.createdAt),
    actorLabel: entry.actorLabel,
    actionLabel: AUDIT_ACTION_LABEL[entry.action as AuditAction] ?? entry.action,
    summary: entry.summary,
  }));

  function buildShowMoreHref(nextShown: number): string {
    const params = new URLSearchParams();
    if (actor) params.set("actor", actor);
    if (action) params.set("action", action);
    params.set("show", String(nextShown));
    return `/admin/audit?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground/80">
        Записів: {total}. Журнал адмін-дій — хто, що і коли змінив. Записи старші за рік
        видаляються автоматично.
      </p>

      <AuditFilters actors={actors} selectedActor={actor} selectedAction={action} />

      <AuditLogTable rows={rows} />

      <LoadMore
        shown={entries.length}
        total={total}
        href={buildShowMoreHref(shown + PAGE_SIZE)}
        label={`Показано ${entries.length} з ${total}`}
      />
    </div>
  );
}
