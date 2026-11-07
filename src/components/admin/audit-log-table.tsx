"use client";

import { LockIcon, Trash2Icon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteAuditLogEntriesAction } from "@/lib/actions/audit";
import { countLabel, RECORD_FORMS } from "@/lib/pluralize";

export type AuditLogRow = {
  id: string;
  createdAtLabel: string;
  actorLabel: string;
  actionLabel: string;
  summary: string;
  /** False for "audit.delete" entries - see isAuditEntryDeletable. */
  deletable: boolean;
};

const LOCKED_HINT = "Запис про видалення не можна видалити";

export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Only ids still on screen count: after a delete or a filter change the
  // server sends a fresh list, and ids that dropped out of it shouldn't
  // linger in the counter or get sent again.
  const deletableIds = rows.filter((row) => row.deletable).map((row) => row.id);
  const selectedIds = deletableIds.filter((id) => selected.has(id));
  const allSelected = deletableIds.length > 0 && selectedIds.length === deletableIds.length;

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function deleteSelected() {
    const ids = selectedIds;
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        const count = await deleteAuditLogEntriesAction(ids);
        setSelected(new Set());
        if (count === 0) {
          toast.error("Ці записи вже видалено");
        } else {
          toast.success(`Видалено ${countLabel(count, RECORD_FORMS)}`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не вдалося видалити записи");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {selectedIds.length > 0
            ? `Вибрано: ${countLabel(selectedIds.length, RECORD_FORMS)}`
            : "Позначте записи, щоб видалити їх."}
        </p>
        <Button
          variant="destructive"
          size="sm"
          disabled={selectedIds.length === 0 || pending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2Icon />
          {pending ? "Видалення…" : "Видалити вибрані"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Вибрати всі записи на сторінці"
                  checked={allSelected}
                  disabled={deletableIds.length === 0 || pending}
                  onCheckedChange={(checked) => setSelected(checked ? new Set(deletableIds) : new Set())}
                />
              </TableHead>
              <TableHead>Час</TableHead>
              <TableHead>Хто</TableHead>
              <TableHead>Дія</TableHead>
              <TableHead>Опис</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isSelected = row.deletable && selected.has(row.id);
              return (
                <TableRow key={row.id} data-state={isSelected ? "selected" : undefined}>
                  <TableCell>
                    {row.deletable ? (
                      <Checkbox
                        aria-label={`Вибрати запис: ${row.summary}`}
                        checked={isSelected}
                        disabled={pending}
                        onCheckedChange={(checked) => toggle(row.id, checked)}
                      />
                    ) : (
                      <span title={LOCKED_HINT} className="flex size-4 items-center justify-center">
                        <LockIcon className="size-3.5 text-muted-foreground" aria-hidden />
                        <span className="sr-only">{LOCKED_HINT}</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{row.createdAtLabel}</TableCell>
                  <TableCell className="font-medium">{row.actorLabel}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{row.actionLabel}</TableCell>
                  <TableCell>{row.summary}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Ще немає жодного запису.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити {countLabel(selectedIds.length, RECORD_FORMS)} з журналу?</AlertDialogTitle>
            <AlertDialogDescription>
              Цю дію не можна скасувати. У журналі залишиться запис про те, хто і скільки записів
              видалив.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteSelected}>
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
