"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions/menu";

const initialState: ActionState = {};

function ToggleButton({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="icon-sm" disabled={pending} title={active ? "Приховати" : "Показати"}>
      {active ? <EyeIcon /> : <EyeOffIcon className="text-muted-foreground" />}
      <span className="sr-only">{active ? "Приховати" : "Показати"}</span>
    </Button>
  );
}

/**
 * A section/item stays in the DB either way - `active` just controls whether
 * /coffee renders it (see getActiveMenuSections). Shared between sections
 * and items since toggleMenuSectionActiveAction/toggleMenuItemActiveAction
 * take the same {id, active} shape.
 */
export function MenuToggleActiveButton({
  id,
  active,
  action,
}: {
  id: string;
  active: boolean;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, initialState);
  // Same silent-rollback bug this class of toggle already got burned by once
  // (SeedToggle/GroupSelect in tournament-roster.tsx) - without this, a
  // failed toggle just snaps back with no explanation.
  const lastHandled = useRef(state);
  useEffect(() => {
    if (state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <ToggleButton active={active} />
    </form>
  );
}
