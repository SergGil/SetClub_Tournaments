"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { MenuPhotoField } from "@/components/admin/menu-photo-field";
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
import { Textarea } from "@/components/ui/textarea";
import { createMenuItemAction, updateMenuItemAction } from "@/lib/actions/menu";
import type { ActionState } from "@/lib/actions/menu";

const initialState: ActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Збереження…" : label}
    </Button>
  );
}

type MenuItemDialogProps = {
  trigger: React.ReactElement;
  sections: { id: string; name: string }[];
  defaultSectionId?: string;
  item?: {
    id: string;
    sectionId: string;
    name: string;
    price: number;
    description: string | null;
    sortOrder: number;
    photoUrl?: string | null;
  };
};

export function MenuItemDialog({ trigger, sections, defaultSectionId, item }: MenuItemDialogProps) {
  const [open, setOpen] = useState(false);
  const initialSectionId = item?.sectionId ?? defaultSectionId ?? sections[0]?.id ?? "";
  const [sectionId, setSectionId] = useState(initialSectionId);
  const sectionItems = Object.fromEntries(sections.map((s) => [s.id, s.name]));
  const action = item ? updateMenuItemAction : createMenuItemAction;
  const [state, formAction] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

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
        if (next) setSectionId(initialSectionId);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{item ? "Редагувати напій" : "Додати напій"}</DialogTitle>
          </DialogHeader>

          {item && <input type="hidden" name="id" value={item.id} />}

          <div className="flex flex-col gap-2">
            <Label htmlFor="item-section">
              Секція
              <RequiredMark />
            </Label>
            <input type="hidden" name="sectionId" value={sectionId} />
            <Select items={sectionItems} value={sectionId} onValueChange={(v) => v && setSectionId(v)}>
              <SelectTrigger id="item-section" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.sectionId && <p className="text-sm text-destructive">{fieldErrors.sectionId}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="item-name">
              Назва
              <RequiredMark />
            </Label>
            <Input
              id="item-name"
              name="name"
              defaultValue={item?.name}
              required
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "item-name-error" : undefined}
            />
            {fieldErrors.name && (
              <p id="item-name-error" className="text-sm text-destructive">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="item-price">
              Ціна, грн
              <RequiredMark />
            </Label>
            <Input
              id="item-price"
              name="price"
              type="number"
              min={0}
              defaultValue={item?.price}
              required
              aria-invalid={Boolean(fieldErrors.price)}
              aria-describedby={fieldErrors.price ? "item-price-error" : undefined}
            />
            {fieldErrors.price && (
              <p id="item-price-error" className="text-sm text-destructive">
                {fieldErrors.price}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="item-description">Опис (опційно)</Label>
            <Textarea
              id="item-description"
              name="description"
              defaultValue={item?.description ?? ""}
              rows={2}
              maxLength={200}
              placeholder="лимонад з вершково-вишневим смаком та блю-кюрасао"
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? "item-description-error" : undefined}
            />
            {fieldErrors.description && (
              <p id="item-description-error" className="text-sm text-destructive">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <MenuPhotoField initialPhotoUrl={item?.photoUrl} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="item-sort-order">Порядок показу</Label>
            <Input id="item-sort-order" name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <SubmitButton label={item ? "Зберегти" : "Додати"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
