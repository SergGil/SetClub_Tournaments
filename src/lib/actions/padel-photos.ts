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

/**
 * Makes `photoId` its tournament's cover - the picture on the /gallery card and
 * on the homepage's "Життя клубу" fallback. At most one cover per tournament,
 * so the others are cleared in the same transaction; without any cover the
 * most recently uploaded photo is used (see getTournamentsWithPhotos).
 */
export async function setPadelTournamentCoverPhotoAction(photoId: string, request?: Request): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL", request);

  if (typeof photoId !== "string" || !photoId) {
    return { error: "Фото не знайдено" };
  }

  const photo = await prisma.padelPhoto.findUnique({
    where: { id: photoId },
    select: { id: true, tournamentId: true, tournament: { select: { name: true } } },
  });
  if (!photo) {
    return { error: "Фото не знайдено — можливо, його вже видалили" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.padelPhoto.updateMany({
        where: { tournamentId: photo.tournamentId, isCover: true, id: { not: photo.id } },
        data: { isCover: false },
      });
      await tx.padelPhoto.update({ where: { id: photo.id }, data: { isCover: true } });
    });
  } catch (error) {
    // Deleted in another tab between the lookup above and the update.
    if (isRecordNotFoundError(error)) {
      return { error: "Фото не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.photo.cover",
    entityType: "PadelPhoto",
    entityId: photo.id,
    summary: `Обкладинку турніру "${photo.tournament.name}" змінено`,
  }));

  revalidatePath(`/padel/tournaments/${photo.tournamentId}`);
  revalidatePath(`/admin/padel/tournaments/${photo.tournamentId}`);
  revalidatePath("/gallery");
  revalidatePath(`/gallery/padel/${photo.tournamentId}`);
  // The homepage's "Життя клубу" falls back to these covers.
  revalidatePath("/");
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
  // Also deletable from the admin Padel tournament's "Фото" tab - see photos.ts.
  revalidatePath(`/admin/padel/tournaments/${photo.tournamentId}`);
  revalidatePath("/gallery");
  revalidatePath(`/gallery/padel/${photo.tournamentId}`);
  return {};
}
