import { LoadMore } from "@/components/load-more";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUDIT_ACTION_LABEL, type AuditAction } from "@/lib/audit";
import { parseShowParam } from "@/lib/load-more";
import { getAuditLogPage } from "@/lib/queries/audit";

export const metadata = { title: "Журнал дій" };

const PAGE_SIZE = 20;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show: showParam } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const { entries, total } = await getAuditLogPage(shown);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground/80">
        Записів: {total}. Журнал адмін-дій — хто, що і коли змінив.
      </p>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Час</TableHead>
              <TableHead>Хто</TableHead>
              <TableHead>Дія</TableHead>
              <TableHead>Опис</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {entry.createdAt.toLocaleString("uk-UA", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell className="font-medium">{entry.actorLabel}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {AUDIT_ACTION_LABEL[entry.action as AuditAction] ?? entry.action}
                </TableCell>
                <TableCell>{entry.summary}</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Ще немає жодного запису.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LoadMore
        shown={entries.length}
        total={total}
        href={`/admin/audit?show=${shown + PAGE_SIZE}`}
        label={`Показано ${entries.length} з ${total}`}
      />
    </div>
  );
}
