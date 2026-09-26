"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAnyDomainAdmin } from "@/lib/permissions";
import { isRecordNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { deleteObject } from "@/lib/r2";
import { confirmHomeGalleryPhotoSchema } from "@/lib/validation/photo";

export async function confirmHomeGalleryPhotoAction(key: string, request?: Request): Promise<{ error?: string }> {
  const session = await requireAnyDomainAdmin(request);

  const parsed = confirmHomeGalleryPhotoSchema.safeParse({ key });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  let photo;
  try {
    photo = await prisma.homeGalleryPhoto.create({ data: { key: parsed.data.key } });
  } catch (error) {
    // Retried/duplicated confirm call for a key already confirmed as a row
    // (HomeGalleryPhoto.key is @unique, same reasoning as Photo.key) - the
    // object in R2 is still fine and still referenced by the existing row.
    if (isUniqueConstraintError(error)) {
      return { error: "Це фото вже завантажено" };
    }
    throw error;
  }

  after(() =>
    logAudit(session.user, {
      action: "home.gallery.upload",
      entityType: "HomeGalleryPhoto",
      entityId: photo.id,
      summary: 'Завантажено фото у секцію "Життя клубу"',
    }),
  );

  revalidatePath("/");
  revalidatePath("/admin/home");
  return {};
}

export async function deleteHomeGalleryPhotoAction(photoId: string, request?: Request): Promise<{ error?: string }> {
  const session = await requireAnyDomainAdmin(request);

  let photo;
  try {
    photo = await prisma.homeGalleryPhoto.delete({ where: { id: photoId } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Фото не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => {
    // Best-effort, not awaited - same reasoning as deletePhotoAction.
    deleteObject(photo.key).catch((error) =>
      console.error("Failed to delete R2 object for home gallery photo", photo.id, photo.key, error),
    );
    return logAudit(session.user, {
      action: "home.gallery.delete",
      entityType: "HomeGalleryPhoto",
      entityId: photo.id,
      summary: 'Видалено фото із секції "Життя клубу"',
    });
  });

  revalidatePath("/");
  revalidatePath("/admin/home");
  return {};
}
