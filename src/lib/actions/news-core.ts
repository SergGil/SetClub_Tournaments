import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAnyDomainAdmin } from "@/lib/permissions";
import { isRecordNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { deleteObject } from "@/lib/r2";
import type { NewsPostFormInput } from "@/lib/validation/news";

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

function cleanUpOldPhoto(key: string) {
  deleteObject(key).catch((error) => console.error("Failed to delete old R2 object for news post", key, error));
}

/** Shared by createNewsPostAction (web form) and POST /api/v1/news (mobile) - see docs/MOBILE_API.md. `photoKey` must already start with "news/" (see readPhotoKeyField) - the API route validates that the same way the form's readPhotoKeyField does. */
export async function createNewsPostCore(
  session: Awaited<ReturnType<typeof requireAnyDomainAdmin>>,
  data: NewsPostFormInput,
  photoKey: string | null,
): Promise<ActionState> {
  let post;
  try {
    post = await prisma.newsPost.create({
      data: { ...data, photoKey, authorId: session.user.id },
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

/** Shared by updateNewsPostAction (web form) and PATCH /api/v1/news/[id] (mobile) - see docs/MOBILE_API.md. `newPhotoKey`/`removePhoto` follow the same convention as the form: a non-null `newPhotoKey` replaces the photo, `removePhoto: true` clears it, otherwise the existing photo is kept. */
export async function updateNewsPostCore(
  session: Awaited<ReturnType<typeof requireAnyDomainAdmin>>,
  id: string,
  data: NewsPostFormInput,
  newPhotoKey: string | null,
  removePhoto: boolean,
): Promise<ActionState> {
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
    await prisma.newsPost.update({ where: { id }, data: { ...data, photoKey } });
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
    summary: `Оновлено новину "${data.title}"`,
  }));

  revalidatePath("/admin/news");
  revalidatePath("/");
  return { success: true };
}

/** Shared by deleteNewsPostAction (web form) and DELETE /api/v1/news/[id] (mobile) - see docs/MOBILE_API.md. */
export async function deleteNewsPostCore(
  session: Awaited<ReturnType<typeof requireAnyDomainAdmin>>,
  id: string,
): Promise<ActionState> {
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