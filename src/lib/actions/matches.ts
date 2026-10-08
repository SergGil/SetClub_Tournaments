"use server";

import { requireDomainAdmin } from "@/lib/permissions";
import { matchFormSchema, scoreFormSchema } from "@/lib/validation/match";
import { fieldErrorsFromZod } from "@/lib/zod-errors";
import {
  createMatchCore,
  updateMatchCore,
  deleteMatchCore,
  saveScoreCore,
  type ActionState,
} from "@/lib/actions/matches-core";

export type { ScoreFormInput, ActionState, MatchFormInput } from "@/lib/actions/matches-core";

/**
 * Player-slot Selects in create-match-dialog.tsx (single-value, not
 * `multiple`) always register a hidden form input for their `name` even
 * with nothing picked yet (Base UI's own progressive-enhancement design -
 * the hidden `<input>` is unconditional, its `value` just serializes to ""
 * when the Select has no selection) - so an unpicked slot arrives here as
 * an empty string in the array, not as a missing entry. Without filtering
 * these out, a genuinely empty/placeholder side (matchFormSchema's
 * `playerIdList.min(0)`, meant for exactly this - a bracket slot whose
 * player isn't decided yet) always fails validation instead, since every
 * element must be a non-empty string.
 */
function nonEmptyFormValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}

export async function createMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const parsed = matchFormSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    matchType: formData.get("matchType"),
    round: formData.get("round"),
    scheduledDate: formData.get("scheduledDate"),
    sideAPlayerIds: nonEmptyFormValues(formData, "sideAPlayerIds"),
    sideBPlayerIds: nonEmptyFormValues(formData, "sideBPlayerIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  return createMatchCore(session, parsed.data);
}

export async function updateMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Матч не знайдено" };
  }

  const parsed = matchFormSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    matchType: formData.get("matchType"),
    round: formData.get("round"),
    scheduledDate: formData.get("scheduledDate"),
    sideAPlayerIds: nonEmptyFormValues(formData, "sideAPlayerIds"),
    sideBPlayerIds: nonEmptyFormValues(formData, "sideBPlayerIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  return updateMatchCore(session, matchId, parsed.data);
}

export async function deleteMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Матч не знайдено" };
  }
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  return deleteMatchCore(session, matchId, acknowledgedCascadeReset);
}

export async function saveScoreAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  let rawSets: unknown;
  try {
    rawSets = JSON.parse(String(formData.get("setsJson") ?? "[]"));
  } catch {
    return { error: "Некоректний рахунок" };
  }

  const parsed = scoreFormSchema.safeParse({
    matchId: formData.get("matchId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    retired: formData.get("retired") === "true",
    retiredWinnerSide: formData.get("retiredWinnerSide") || null,
    sets: rawSets,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректний рахунок",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  return saveScoreCore(session, parsed.data, acknowledgedCascadeReset);
}
