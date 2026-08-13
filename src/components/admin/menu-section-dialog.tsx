"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { RequiredMark } from "@/components/admin/required-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMenuSectionAction, updateMenuSectionAction } from "@/lib/actions/menu";
import type { ActionState } from "@/lib/actions/menu";
import { MENU_LAYOUT_LABEL } from "@/lib/validation/menu";

const initialState: ActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Збереження…" : label}
    </Button>
  );
}

type MenuSectionDialogProps = {
  trigger: React.ReactElement;
  section?: {
    id: string;
    name: string;
    tagline: string | null;
    layout: string;
    sortOrder: number;
  };
};

export function MenuSectionDialog({ trigger, section }: MenuSectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState(section?.layout ?? "LIST");
  const action = section ? updateMenuSectionAction : createMenuSectionAction;
  const [state, formAction] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  // Adjusts state during render (react.dev's "storing information from
  // previous renders" pattern) - deliberately NOT gated on `open`, same
  // reasoning as PlayerDialog/NewsDialog.
  const [handledState, setHandledState] = useState(state);
  if (state.success && state !== handledState) {
    setHandledState(state);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setLayout(section?.layout ?? "LIST");
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{section ? "Редагувати секцію" : "Додати секцію"}</DialogTitle>
          </DialogHeader>

          {section && <input type="hidden" name="id" value={section.id} />}

          <div className="flex flex-col gap-2">
            <Label htmlFor="section-name">
              Назва
              <RequiredMark />
            </Label>
            <Input
              id="section-name"
              name="name"
              defaultValue={section?.name}
              required
              maxLength={60}
              placeholder="Кава, Special Menu…"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "section-name-error" : undefined}
            />
            {fieldErrors.name && (
              <p id="section-name-error" className="text-sm text-destructive">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="section-tagline">Підзаголовок (опційно)</Label>
            <Input
              id="section-tagline"
              name="tagline"
              defaultValue={section?.tagline ?? ""}
              maxLength={80}
              placeholder="love yourself, drink matcha"
              aria-invalid={Boolean(fieldErrors.tagline)}
              aria-describedby={fieldErrors.tagline ? "section-tagline-error" : undefined}
            />
            {fieldErrors.tagline && (
              <p id="section-tagline-error" className="text-sm text-destructive">
                {fieldErrors.tagline}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="section-layout">
              Вигляд
              <RequiredMark />
            </Label>
            <input type="hidden" name="layout" value={layout} />
            <Select items={MENU_LAYOUT_LABEL} value={layout} onValueChange={(v) => v && setLayout(v)}>
              <SelectTrigger id="section-layout" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MENU_LAYOUT_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="section-sort-order">Порядок показу</Label>
            <Input
              id="section-sort-order"
              name="sortOrder"
              type="number"
              defaultValue={section?.sortOrder ?? 0}
              aria-invalid={Boolean(fieldErrors.sortOrder)}
              aria-describedby={fieldErrors.sortOrder ? "section-sort-order-error" : undefined}
            />
            <p className="text-xs text-muted-foreground">
              Секції показуються за зростанням цього числа — лишайте проміжки (10, 20, 30…), щоб
              легше було вставити нову між існуючими.
            </p>
            {fieldErrors.sortOrder && (
              <p id="section-sort-order-error" className="text-sm text-destructive">
                {fieldErrors.sortOrder}
              </p>
            )}
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <SubmitButton label={section ? "Зберегти" : "Створити"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
