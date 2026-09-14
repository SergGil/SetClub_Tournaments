"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { RequiredMark } from "@/components/admin/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCoffeePageSettingsAction } from "@/lib/actions/coffee-settings";
import type { ActionState } from "@/lib/actions/coffee-settings";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Збереження…" : "Зберегти"}
    </Button>
  );
}

export function CoffeeHeroForm({ heroTitle, heroSubtitle }: { heroTitle: string; heroSubtitle: string }) {
  const [state, formAction] = useActionState(updateCoffeePageSettingsAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  // The toast itself IS a legitimate effect (an imperative call into an
  // external system, not a setState) - stays in useEffect so it fires once
  // per action result rather than once per render.
  useEffect(() => {
    if (state.success) toast.success("Заголовок сторінки збережено");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div>
        <p className="font-medium">Заголовок сторінки «Меню»</p>
        <p className="text-xs text-muted-foreground">Текст над списком напоїв на /coffee.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-title">
          Заголовок
          <RequiredMark />
        </Label>
        <Input
          id="hero-title"
          name="heroTitle"
          defaultValue={heroTitle}
          required
          maxLength={60}
          aria-invalid={Boolean(fieldErrors.heroTitle)}
          aria-describedby={fieldErrors.heroTitle ? "hero-title-error" : undefined}
        />
        {fieldErrors.heroTitle && (
          <p id="hero-title-error" className="text-sm text-destructive">
            {fieldErrors.heroTitle}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-subtitle">
          Підзаголовок
          <RequiredMark />
        </Label>
        <Textarea
          id="hero-subtitle"
          name="heroSubtitle"
          defaultValue={heroSubtitle}
          required
          rows={2}
          maxLength={200}
          aria-invalid={Boolean(fieldErrors.heroSubtitle)}
          aria-describedby={fieldErrors.heroSubtitle ? "hero-subtitle-error" : undefined}
        />
        {fieldErrors.heroSubtitle && (
          <p id="hero-subtitle-error" className="text-sm text-destructive">
            {fieldErrors.heroSubtitle}
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
