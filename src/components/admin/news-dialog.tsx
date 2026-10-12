"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { NewsPhotoField } from "@/components/admin/news-photo-field";
import { RequiredMark } from "@/components/admin/required-mark";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

// A textarea always reports line breaks as LF, but a body that came back from
// a form post is stored with CRLF (browsers normalise textarea newlines to
// CRLF on submit). Comparing the two raw would flag an edit that was typed and
// reverted as changed, and over-count the length by one per line break.
const toLf = (text: string) => text.replaceAll("\r\n", "\n");

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
  post?: { id: string; title: string; body: string; photoUrl?: string | null };
};

export function NewsDialog({ trigger, post }: NewsDialogProps) {
  const [open, setOpen] = useState(false);
  const action = post ? updateNewsPostAction : createNewsPostAction;
  const [state, formAction] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  // Controlled (not defaultValue) so the "leave without saving?" check below
  // can see what's actually typed, and so a rejected submit doesn't wipe the
  // admin's text - React resets *uncontrolled* fields after a form action.
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(toLf(post?.body ?? ""));
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  // Reported by the photo field: a file picked (or still uploading) or the
  // saved photo cleared. Its own state lives inside the field, which Base UI
  // unmounts on close - hence reset on every open below.
  const [photoDirty, setPhotoDirty] = useState(false);

  // Create: anything typed or picked counts. Edit: only a change from the saved post.
  const isDirty =
    photoDirty || (post ? title !== post.title || body !== toLf(post.body) : title.trim() !== "" || body.trim() !== "");

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
    setConfirmLeaveOpen(false);
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      // Discard any leftover draft from a previous cancelled edit or a
      // just-completed submit - Base UI unmounts the dialog content on
      // close, but this state lives out here and doesn't follow along.
      setTitle(post?.title ?? "");
      setBody(toLf(post?.body ?? ""));
      setPhotoDirty(false);
      setConfirmLeaveOpen(false);
      setOpen(true);
      return;
    }
    // Every dismissal path (X, Escape, click on the backdrop) lands here.
    // With unsaved text, keep the dialog open and ask first instead of
    // silently throwing the draft away.
    if (isDirty) {
      setConfirmLeaveOpen(true);
      return;
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Покинути без збереження?</AlertDialogTitle>
              <AlertDialogDescription>
                {post ? "Внесені зміни" : "Введені дані"} буде втрачено.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Залишитись</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setConfirmLeaveOpen(false);
                  setOpen(false);
                }}
              >
                Покинути
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
              <span className="text-xs text-muted-foreground">{title.length}/150</span>
            </div>
            <Input
              id="title"
              name="title"
              value={title}
              required
              maxLength={150}
              onChange={(e) => setTitle(e.target.value)}
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
              <span className="text-xs text-muted-foreground">{body.length}/5000</span>
            </div>
            <Textarea
              id="body"
              name="body"
              value={body}
              required
              maxLength={5000}
              // Textarea's base `field-sizing-content` ignores `rows`, so the
              // height comes from min-h; max-h keeps the submit button on
              // screen for long posts (the box scrolls instead).
              className="min-h-64 max-h-[55vh] resize-y"
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={Boolean(fieldErrors.body)}
              aria-describedby={fieldErrors.body ? "body-error" : undefined}
            />
            {fieldErrors.body && (
              <p id="body-error" className="text-sm text-destructive">
                {fieldErrors.body}
              </p>
            )}
          </div>

          <NewsPhotoField initialPhotoUrl={post?.photoUrl} onDirtyChange={setPhotoDirty} />

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <SubmitButton label={post ? "Зберегти" : "Опублікувати"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
