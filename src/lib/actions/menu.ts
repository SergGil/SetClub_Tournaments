"use server";

import { requireDomainAdmin } from "@/lib/permissions";
import { menuItemFormSchema, menuSectionFormSchema } from "@/lib/validation/menu";
import { fieldErrorsFromZod } from "@/lib/zod-errors";
import {
  createMenuSectionCore,
  updateMenuSectionCore,
  toggleMenuSectionActiveCore,
  deleteMenuSectionCore,
  createMenuItemCore,
  updateMenuItemCore,
  toggleMenuItemActiveCore,
  deleteMenuItemCore,
  type ActionState,
} from "@/lib/actions/menu-core";

export type { ActionState } from "@/lib/actions/menu-core";

export async function createMenuSectionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("COFFEE");

  const parsed = menuSectionFormSchema.safeParse({
    name: formData.get("name"),
    tagline: formData.get("tagline"),
    layout: formData.get("layout"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  return createMenuSectionCore(session, parsed.data);
}

export async function updateMenuSectionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("COFFEE");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Секцію не знайдено" };
  }

  const parsed = menuSectionFormSchema.safeParse({
    name: formData.get("name"),
    tagline: formData.get("tagline"),
    layout: formData.get("layout"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  return updateMenuSectionCore(session, id, parsed.data);
}

export async function toggleMenuSectionActiveAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("COFFEE");

  const id = formData.get("id");
  const active = formData.get("active") === "true";
  if (typeof id !== "string" || !id) {
    return { error: "Секцію не знайдено" };
  }

  return toggleMenuSectionActiveCore(session, id, active);
}

export async function deleteMenuSectionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("COFFEE");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Секцію не знайдено" };
  }

  return deleteMenuSectionCore(session, id);
}

// --- Items ------------------------------------------------------------

/**
 * A photo is already sitting in R2 by submit time (uploaded via
 * MenuPhotoField's own presigned PUT, same "browser -> R2 direct" flow as
 * a news post's cover photo - see docs/PHOTOS.md) - this just reads back the
 * key the client reports, checking it actually came from the menu presign
 * route (`menu/...`) rather than pointing at some unrelated object in the
 * bucket. That prefix check alone doesn't stop an admin pasting a *different*
 * item's still-live key (R2 keys aren't secret); MenuItem.photoKey's
 * `@unique` constraint is what actually blocks that - see the
 * isUniqueConstraintError branches below.
 */
function readPhotoKeyField(formData: FormData): string | null | { error: string } {
  const raw = formData.get("photoKey");
  if (typeof raw !== "string" || !raw) return null;
  if (!raw.startsWith("menu/")) return { error: "Некоректний ключ фото" };
  return raw;
}

export async function createMenuItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("COFFEE");

  const parsed = menuItemFormSchema.safeParse({
    sectionId: formData.get("sectionId"),
    name: formData.get("name"),
    price: formData.get("price"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const photoKey = readPhotoKeyField(formData);
  if (photoKey && typeof photoKey === "object") return { error: photoKey.error };

  return createMenuItemCore(session, parsed.data, photoKey);
}

export async function updateMenuItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("COFFEE");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Напій не знайдено" };
  }

  const parsed = menuItemFormSchema.safeParse({
    sectionId: formData.get("sectionId"),
    name: formData.get("name"),
    price: formData.get("price"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const newPhotoKey = readPhotoKeyField(formData);
  if (newPhotoKey && typeof newPhotoKey === "object") return { error: newPhotoKey.error };
  const removePhoto = formData.get("removePhoto") === "true";

  return updateMenuItemCore(session, id, parsed.data, newPhotoKey, removePhoto);
}

export async function toggleMenuItemActiveAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("COFFEE");

  const id = formData.get("id");
  const active = formData.get("active") === "true";
  if (typeof id !== "string" || !id) {
    return { error: "Напій не знайдено" };
  }

  return toggleMenuItemActiveCore(session, id, active);
}

export async function deleteMenuItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("COFFEE");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Напій не знайдено" };
  }

  return deleteMenuItemCore(session, id);
}
