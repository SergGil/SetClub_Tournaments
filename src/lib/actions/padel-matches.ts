"use server";

import { requireDomainAdmin } from "@/lib/permissions";
// Padel courts use the same set/game/tiebreak scoring rules as Tennis, and
// matchFormSchema/scoreFormSchema have zero Prisma-model coupling (plain
// shape/business-rule validation) - reused as-is rather than cloned.
import { matchFormSchema, scoreFormSchema } from "@/lib/validation/match";
import { fieldErrorsFromZod } from "@/lib/zod-errors";
import {
  createPadelMatchCore,
  updatePadelMatchCore,
  deletePadelMatchCore,
  savePadelScoreCore,
  type ActionState,
} from "@/lib/actions/padel-matches-core";

export type { ActionState } from "@/lib/actions/padel-matches-core";

/** See the identical helper in matches.ts for the full Base UI Select rationale. */
function nonEmptyFormValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}

export async function createPadelMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

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

  return createPadelMatchCore(session, parsed.data);
}

export async function updatePadelMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

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

  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  return updatePadelMatchCore(session, matchId, parsed.data, acknowledgedCascadeReset);
}

export async function deletePadelMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Матч не знайдено" };
  }
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  return deletePadelMatchCore(session, matchId, acknowledgedCascadeReset);
}

export async function savePadelScoreAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const setsJson = formData.get("setsJson") ?? "[]";
  if (typeof setsJson !== "string") return { error: "Некоректний рахунок" };
  let rawSets: unknown;
  try {
    rawSets = JSON.parse(setsJson);
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

  return savePadelScoreCore(session, parsed.data, acknowledgedCascadeReset);
}
