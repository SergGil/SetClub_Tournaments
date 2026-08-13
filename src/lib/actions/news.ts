"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAnyDomainAdmin } from "@/lib/permissions";
import { isRecordNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { deleteObject } from "@/lib/r2";
import { newsPostFormSchema } from "@/lib/validation/news";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

/**
 * A cover photo is already sitting in R2 by submit time (uploaded via
 * NewsPhotoField's own presigned PUT, same "browser -> R2 direct" flow as
 * tournament photos - see docs/PHOTOS.md) - this just reads back the key the
 * client reports, checking it actually came from the news presign route
 * (`news/...`) rather than pointing at some unrelated object in the bucket.
 * That prefix check alone doesn't stop an admin pasting a *different* post's
 * still-live key (R2 keys aren't secret - visible in every public photo URL);
 * `NewsPost.photoKey`'s `@unique` constraint is what actually blocks that -
 * see the isUniqueConstraintError branches below.
 */
function readPhotoKeyField(formData: FormData): string | null | { error: string } {
  const raw = formData.get("photoKey");
  if (typeof raw !== "string" || !raw) return null;
  if (!raw.startsWith("news/")) return { error: "Некоректний ключ фото" };
  return raw;
}

function cleanUpOldPhoto(key: string) {
  deleteObject(key).catch((error) => console.error("Failed to delete old R2 object for news post", key, error));
}

export async function createNewsPostAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAnyDomainAdmin();

  const parsed = newsPostFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const photoKey = readPhotoKeyField(formData);
  if (photoKey && typeof photoKey === "object") return { error: photoKey.error };

  let post;
  try {
    post = await prisma.newsPost.create({
      data: { ...parsed.data, photoKey, authorId: session.user.id },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Це фото вже використовується в іншій новині — оберіть інше." };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "news.create",
    entityType: "NewsPost",
    entityId: post.id,
    summary: `Створено новину "${post.title}"`,
  }));

  revalidatePath("/admin/news");
  revalidatePath("/");
  return { success: true };
}

export async function updateNewsPostAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAnyDomainAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Новину не знайдено" };
  }

  const parsed = newsPostFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
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

  let existing;
  try {
    existing = await prisma.newsPost.findUniqueOrThrow({ where: { id }, select: { photoKey: true } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Новину не знайдено — можливо, її вже видалили" };
    }
    throw error;
  }
  const photoKey = newPhotoKey ?? (removePhoto ? null : existing.photoKey);

  try {
    await prisma.newsPost.update({ where: { id }, data: { ...parsed.data, photoKey } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Новину не знайдено — можливо, її вже видалили" };
    }
    if (isUniqueConstraintError(error)) {
      return { error: "Це фото вже використовується в іншій новині — оберіть інше." };
    }
    throw error;
  }

  if (existing.photoKey && existing.photoKey !== photoKey) cleanUpOldPhoto(existing.photoKey);

  after(() => logAudit(session.user, {
    action: "news.update",
    entityType: "NewsPost",
    entityId: id,
    summary: `Оновлено новину "${parsed.data.title}"`,
  }));

  revalidatePath("/admin/news");
  revalidatePath("/");
  return { success: true };
}

export async function deleteNewsPostAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAnyDomainAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Новину не знайдено" };
  }

  let deleted;
  try {
    deleted = await prisma.newsPost.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Новину не знайдено — можливо, її вже видалили" };
    }
    throw error;
  }

  if (deleted.photoKey) cleanUpOldPhoto(deleted.photoKey);

  after(() => logAudit(session.user, {
    action: "news.delete",
    entityType: "NewsPost",
    entityId: id,
    summary: `Видалено новину "${deleted.title}"`,
  }));

  revalidatePath("/admin/news");
  revalidatePath("/");
  return { success: true };
}
