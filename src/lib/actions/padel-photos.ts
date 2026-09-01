"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { isForeignKeyError, isRecordNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { deleteObject } from "@/lib/r2";
import { confirmPadelPhotoSchema } from "@/lib/validation/photo";

/** Padel twin of actions/photos.ts. */
export async function confirmPadelPhotoUploadAction(
  tournamentId: string,
  key: string,
  caption?: string,
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL", request);

  const parsed = confirmPadelPhotoSchema.safeParse({ tournamentId, key, caption });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  let photo;
  try {
    photo = await prisma.padelPhoto.create({
      data: {
        tournamentId: parsed.data.tournamentId,
        key: parsed.data.key,
        caption: parsed.data.caption,
        uploadedById: session.user.id,
      },
      include: { tournament: { select: { name: true } } },
    });
  } catch (error) {
    if (isForeignKeyError(error)) {
      deleteObject(parsed.data.key).catch((cleanupError) =>
        console.error("Failed to clean up orphaned R2 object", parsed.data.key, cleanupError),
      );
      return { error: "Турнір не знайдено — можливо, його вже видалили" };
    }
    if (isUniqueConstraintError(error)) {
      return { error: "Це фото вже завантажено" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.photo.upload",
    entityType: "PadelPhoto",
    entityId: photo.id,
    summary: `Завантажено фото до турніру (Падел) "${photo.tournament.name}"`,
  }));

  // Same reasoning as confirmPhotoUploadAction - deliberately not
  // revalidatePath(`/padel/tournaments/${tournamentId}`), see photos.ts.
  revalidatePath("/gallery");
  revalidatePath(`/gallery/padel/${parsed.data.tournamentId}`);
  return {};
}

export async function deletePadelPhotoAction(photoId: string, request?: Request): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL", request);

  let photo;
  try {
    photo = await prisma.padelPhoto.delete({
      where: { id: photoId },
      include: { tournament: { select: { name: true } } },
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Фото не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => {
    deleteObject(photo.key).catch((error) =>
      console.error("Failed to delete R2 object for padel photo", photo.id, photo.key, error),
    );
    return logAudit(session.user, {
      action: "padel.photo.delete",
      entityType: "PadelPhoto",
      entityId: photo.id,
      summary: `Видалено фото з турніру (Падел) "${photo.tournament.name}"`,
    });
  });

  revalidatePath(`/padel/tournaments/${photo.tournamentId}`);
  revalidatePath("/gallery");
  revalidatePath(`/gallery/padel/${photo.tournamentId}`);
  return {};
}
