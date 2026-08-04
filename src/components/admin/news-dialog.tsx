"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{post ? "Редагувати новину" : "Додати новину"}</DialogTitle>
          </DialogHeader>

          {post && <input type="hidden" name="id" value={post.id} />}

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Заголовок</Label>
            <Input id="title" name="title" defaultValue={post?.title} required maxLength={150} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="body">Текст</Label>
            <Textarea id="body" name="body" defaultValue={post?.body} required rows={6} />
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
