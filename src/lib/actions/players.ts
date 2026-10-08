"use server";

import { requireDomainsAdmin } from "@/lib/permissions";
import { playerFormSchema } from "@/lib/validation/player";
import { fieldErrorsFromZod } from "@/lib/zod-errors";
import {
  createPlayerCore,
  updatePlayerCore,
  deletePlayerCore,
  unlinkPlayerCore,
  linkPlayerCore,
  type ActionState,
} from "@/lib/actions/players-core";

export type { ActionState } from "@/lib/actions/players-core";

export async function createPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const parsed = playerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    gender: formData.get("gender"),
    sports: formData.get("sports"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  return createPlayerCore(session, parsed.data);
}

export async function updatePlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  const parsed = playerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    gender: formData.get("gender"),
    sports: formData.get("sports"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  return updatePlayerCore(session, id, parsed.data);
}

export async function deletePlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  return deletePlayerCore(session, id);
}

export async function unlinkPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  return unlinkPlayerCore(session, id);
}

export async function linkPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const playerId = formData.get("playerId");
  const userId = formData.get("userId");
  if (typeof playerId !== "string" || typeof userId !== "string" || !userId) {
    return { error: "Оберіть користувача" };
  }

  return linkPlayerCore(session, playerId, userId);
}
