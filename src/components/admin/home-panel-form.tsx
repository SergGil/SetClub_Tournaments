"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { RequiredMark } from "@/components/admin/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateHomePanelSettingsAction } from "@/lib/actions/home-panels";
import type { ActionState } from "@/lib/actions/home-panels";
import { HOME_PANEL_DOMAIN_LABEL, homePanelDomainValues } from "@/lib/validation/home-panels";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Збереження…" : "Зберегти"}
    </Button>
  );
}

type HomePanelFormProps = {
  panelKey: (typeof homePanelDomainValues)[number];
  eyebrow: string | null;
  title: string;
  description: string | null;
};

export function HomePanelForm({ panelKey, eyebrow, title, description }: HomePanelFormProps) {
  const [state, formAction] = useActionState(updateHomePanelSettingsAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const idPrefix = `home-panel-${panelKey.toLowerCase()}`;
  const [eyebrowLength, setEyebrowLength] = useState(eyebrow?.length ?? 0);
  const [titleLength, setTitleLength] = useState(title.length);
  const [descriptionLength, setDescriptionLength] = useState(description?.length ?? 0);

  useEffect(() => {
    if (state.success) toast.success(`Панель «${HOME_PANEL_DOMAIN_LABEL[panelKey]}» збережено`);
  }, [state, panelKey]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <input type="hidden" name="key" value={panelKey} />
      <p className="font-medium">{HOME_PANEL_DOMAIN_LABEL[panelKey]}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={`${idPrefix}-eyebrow`}>Підпис над назвою (опційно)</Label>
            <span className="text-xs text-muted-foreground">{eyebrowLength}/30</span>
          </div>
          <Input
            id={`${idPrefix}-eyebrow`}
            name="eyebrow"
            defaultValue={eyebrow ?? ""}
            maxLength={30}
            placeholder="Клуб, Спешелті…"
            onChange={(e) => setEyebrowLength(e.target.value.length)}
            aria-invalid={Boolean(fieldErrors.eyebrow)}
            aria-describedby={fieldErrors.eyebrow ? `${idPrefix}-eyebrow-error` : undefined}
          />
          {fieldErrors.eyebrow && (
            <p id={`${idPrefix}-eyebrow-error`} className="text-sm text-destructive">
              {fieldErrors.eyebrow}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={`${idPrefix}-title`}>
              Велика назва
              <RequiredMark />
            </Label>
            <span className="text-xs text-muted-foreground">{titleLength}/20</span>
          </div>
          <Input
            id={`${idPrefix}-title`}
            name="title"
            defaultValue={title}
            required
            maxLength={20}
            placeholder="ТЕНІС, КАВА, ПАДЕЛ…"
            onChange={(e) => setTitleLength(e.target.value.length)}
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? `${idPrefix}-title-error` : undefined}
          />
          {fieldErrors.title && (
            <p id={`${idPrefix}-title-error`} className="text-sm text-destructive">
              {fieldErrors.title}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={`${idPrefix}-description`}>Опис (опційно)</Label>
          <span className="text-xs text-muted-foreground">{descriptionLength}/160</span>
        </div>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          defaultValue={description ?? ""}
          rows={2}
          maxLength={160}
          onChange={(e) => setDescriptionLength(e.target.value.length)}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? `${idPrefix}-description-error` : undefined}
        />
        {fieldErrors.description && (
          <p id={`${idPrefix}-description-error`} className="text-sm text-destructive">
            {fieldErrors.description}
          </p>
        )}
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
