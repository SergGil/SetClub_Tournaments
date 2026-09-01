"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { isRecordNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { deleteObject } from "@/lib/r2";
import { menuItemFormSchema, menuSectionFormSchema } from "@/lib/validation/menu";
import type { MenuItemFormInput, MenuSectionFormInput } from "@/lib/validation/menu";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

function revalidateMenuPaths() {
  revalidatePath("/admin/menu");
  revalidatePath("/coffee");
}

// --- Sections -------------------------------------------------------------

/** Shared by createMenuSectionAction (web form) and POST /api/v1/menu/sections (mobile) - see docs/MOBILE_API.md. */
export async function createMenuSectionCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  data: MenuSectionFormInput,
): Promise<ActionState> {
  const section = await prisma.menuSection.create({ data });

  after(() => logAudit(session.user, {
    action: "menu.section.create",
    entityType: "MenuSection",
    entityId: section.id,
    summary: `Створено секцію меню "${section.name}"`,
  }));

  revalidateMenuPaths();
  return { success: true };
}

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

/** Shared by updateMenuSectionAction (web form) and PATCH /api/v1/menu/sections/[id] (mobile) - see docs/MOBILE_API.md. */
export async function updateMenuSectionCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  data: MenuSectionFormInput,
): Promise<ActionState> {
  try {
    await prisma.menuSection.update({ where: { id }, data });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Секцію не знайдено — можливо, її вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "menu.section.update",
    entityType: "MenuSection",
    entityId: id,
    summary: `Оновлено секцію меню "${data.name}"`,
  }));

  revalidateMenuPaths();
  return { success: true };
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

/** Shared by toggleMenuSectionActiveAction (web form) and PATCH /api/v1/menu/sections/[id]/active (mobile) - see docs/MOBILE_API.md. */
export async function toggleMenuSectionActiveCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  active: boolean,
): Promise<ActionState> {
  let section;
  try {
    section = await prisma.menuSection.update({ where: { id }, data: { active } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Секцію не знайдено — можливо, її вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: active ? "menu.section.activate" : "menu.section.deactivate",
    entityType: "MenuSection",
    entityId: id,
    summary: `${active ? "Показано" : "Приховано"} секцію меню "${section.name}"`,
  }));

  revalidateMenuPaths();
  return { success: true };
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

/** Shared by deleteMenuSectionAction (web form) and DELETE /api/v1/menu/sections/[id] (mobile) - see docs/MOBILE_API.md. */
export async function deleteMenuSectionCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
): Promise<ActionState> {
  // Read the section's name and every item's photoKey before deleting - the
  // delete below cascades every MenuItem row away at the DB level
  // (onDelete: Cascade), which would otherwise leave their R2 photos orphaned
  // with no row left to point at them.
  const existing = await prisma.menuSection.findUnique({
    where: { id },
    select: { name: true, items: { select: { photoKey: true } } },
  });

  let deleted;
  try {
    deleted = await prisma.menuSection.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Секцію не знайдено — можливо, її вже видалили" };
    }
    throw error;
  }

  for (const { photoKey } of existing?.items ?? []) {
    if (photoKey) cleanUpOldPhoto(photoKey);
  }

  after(() => logAudit(session.user, {
    action: "menu.section.delete",
    entityType: "MenuSection",
    entityId: id,
    summary: `Видалено секцію меню "${deleted.name}" (разом з усіма її напоями)`,
  }));

  revalidateMenuPaths();
  return { success: true };
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

function cleanUpOldPhoto(key: string) {
  deleteObject(key).catch((error) => console.error("Failed to delete old R2 object for menu item", key, error));
}

/** Shared by createMenuItemAction (web form) and POST /api/v1/menu/items (mobile) - see docs/MOBILE_API.md. */
export async function createMenuItemCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  data: MenuItemFormInput,
  photoKey: string | null,
): Promise<ActionState> {
  let item;
  try {
    item = await prisma.menuItem.create({ data: { ...data, photoKey } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Це фото вже використовується в іншому пункті меню — оберіть інше." };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "menu.item.create",
    entityType: "MenuItem",
    entityId: item.id,
    summary: `Додано напій "${item.name}" (${item.price} грн)`,
  }));

  revalidateMenuPaths();
  return { success: true };
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

/** Shared by updateMenuItemAction (web form) and PATCH /api/v1/menu/items/[id] (mobile) - see docs/MOBILE_API.md. */
export async function updateMenuItemCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  data: MenuItemFormInput,
  newPhotoKey: string | null,
  removePhoto: boolean,
): Promise<ActionState> {
  let existing;
  try {
    existing = await prisma.menuItem.findUniqueOrThrow({ where: { id }, select: { photoKey: true } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Напій не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }
  const photoKey = newPhotoKey ?? (removePhoto ? null : existing.photoKey);

  try {
    await prisma.menuItem.update({ where: { id }, data: { ...data, photoKey } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Напій не знайдено — можливо, його вже видалили" };
    }
    if (isUniqueConstraintError(error)) {
      return { error: "Це фото вже використовується в іншому пункті меню — оберіть інше." };
    }
    throw error;
  }

  if (existing.photoKey && existing.photoKey !== photoKey) cleanUpOldPhoto(existing.photoKey);

  after(() => logAudit(session.user, {
    action: "menu.item.update",
    entityType: "MenuItem",
    entityId: id,
    summary: `Оновлено напій "${data.name}"`,
  }));

  revalidateMenuPaths();
  return { success: true };
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

/** Shared by toggleMenuItemActiveAction (web form) and PATCH /api/v1/menu/items/[id]/active (mobile) - see docs/MOBILE_API.md. */
export async function toggleMenuItemActiveCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  active: boolean,
): Promise<ActionState> {
  let item;
  try {
    item = await prisma.menuItem.update({ where: { id }, data: { active } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Напій не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: active ? "menu.item.activate" : "menu.item.deactivate",
    entityType: "MenuItem",
    entityId: id,
    summary: `${active ? "Показано" : "Приховано"} напій "${item.name}"`,
  }));

  revalidateMenuPaths();
  return { success: true };
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

/** Shared by deleteMenuItemAction (web form) and DELETE /api/v1/menu/items/[id] (mobile) - see docs/MOBILE_API.md. */
export async function deleteMenuItemCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
): Promise<ActionState> {
  let deleted;
  try {
    deleted = await prisma.menuItem.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Напій не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  if (deleted.photoKey) cleanUpOldPhoto(deleted.photoKey);

  after(() => logAudit(session.user, {
    action: "menu.item.delete",
    entityType: "MenuItem",
    entityId: id,
    summary: `Видалено напій "${deleted.name}"`,
  }));

  revalidateMenuPaths();
  return { success: true };
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
