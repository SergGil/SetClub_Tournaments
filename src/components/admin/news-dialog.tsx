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
import { Textarea } from "@/components/ui/textarea";
import { createNewsPostAction, updateNewsPostAction } from "@/lib/actions/news";
import type { ActionState } from "@/lib/actions/news";

const initialState: ActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Збереження…" : label}
    </Button>
  );
}

type NewsDialogProps = {
  trigger: React.ReactElement;
  post?: { id: string; title: string; body: string };
};

export function NewsDialog({ trigger, post }: NewsDialogProps) {
  const [open, setOpen] = useState(false);
  const action = post ? updateNewsPostAction : createNewsPostAction;
  const [state, formAction] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const [titleLength, setTitleLength] = useState(post?.title.length ?? 0);
  const [bodyLength, setBodyLength] = useState(post?.body.length ?? 0);

  // Adjusts state during render (react.dev's "storing information from
  // previous renders" pattern - a useState setter call here is fine, unlike
  // mutating a ref during render or calling setState inside an effect,
  // both of which this project's stricter Compiler-aware lint rules
  // reject). Deliberately NOT gated on `open`: a save that resolves after
  // the admin already closed the dialog must still mark `state` as handled
  // here, or the *next* time the same dialog is reopened, this would see
  // that same already-resolved state as new and close it again.
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
        if (next) {
          // Discard any leftover draft-length count from a previous
          // cancelled edit or a just-completed submit - the inputs
          // themselves reset to defaultValue on reopen (Base UI unmounts
          // dialog content on close), but these counters are separate state
          // that doesn't follow along on its own.
          setTitleLength(post?.title.length ?? 0);
          setBodyLength(post?.body.length ?? 0);
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{post ? "Редагувати новину" : "Додати новину"}</DialogTitle>
          </DialogHeader>

          {post && <input type="hidden" name="id" value={post.id} />}

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="title">
                Заголовок
                <RequiredMark />
              </Label>
              <span className="text-xs text-muted-foreground">{titleLength}/150</span>
            </div>
            <Input
              id="title"
              name="title"
              defaultValue={post?.title}
              required
              maxLength={150}
              onChange={(e) => setTitleLength(e.target.value.length)}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? "title-error" : undefined}
            />
            {fieldErrors.title && (
              <p id="title-error" className="text-sm text-destructive">
                {fieldErrors.title}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="body">
                Текст
                <RequiredMark />
              </Label>
              <span className="text-xs text-muted-foreground">{bodyLength}/5000</span>
            </div>
            <Textarea
              id="body"
              name="body"
              defaultValue={post?.body}
              required
              rows={6}
              maxLength={5000}
              onChange={(e) => setBodyLength(e.target.value.length)}
              aria-invalid={Boolean(fieldErrors.body)}
              aria-describedby={fieldErrors.body ? "body-error" : undefined}
            />
            {fieldErrors.body && (
              <p id="body-error" className="text-sm text-destructive">
                {fieldErrors.body}
              </p>
            )}
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <SubmitButton label={post ? "Зберегти" : "Опублікувати"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
