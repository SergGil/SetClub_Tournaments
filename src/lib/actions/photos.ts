"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { isForeignKeyError, isRecordNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { deleteObject } from "@/lib/r2";
import { confirmPhotoSchema } from "@/lib/validation/photo";

export async function confirmPhotoUploadAction(
  tournamentId: string,
  key: string,
  caption?: string,
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

  const parsed = confirmPhotoSchema.safeParse({ tournamentId, key, caption });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  let photo;
  try {
    photo = await prisma.photo.create({
      data: {
        tournamentId: parsed.data.tournamentId,
        key: parsed.data.key,
        caption: parsed.data.caption,
        uploadedById: session.user.id,
      },
      include: { tournament: { select: { name: true } } },
    });
  } catch (error) {
    // Admin passed a tournamentId that no longer exists (e.g. deleted in
    // another tab between opening the upload dialog and confirming) - the
    // object already landed in R2 via the presigned PUT, so clean it up
    // rather than leave an orphan nothing will ever reference.
    if (isForeignKeyError(error)) {
      deleteObject(parsed.data.key).catch((cleanupError) =>
        console.error("Failed to clean up orphaned R2 object", parsed.data.key, cleanupError),
      );
      return { error: "Турнір не знайдено — можливо, його вже видалили" };
    }
    // Retried/duplicated confirm call for a key already confirmed as a Photo
    // row (Photo.key is @unique) - the object in R2 is still fine and still
    // referenced by the existing row, so there's nothing to clean up here.
    if (isUniqueConstraintError(error)) {
      return { error: "Це фото вже завантажено" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "photo.upload",
    entityType: "Photo",
    entityId: photo.id,
    summary: `Завантажено фото до турніру "${photo.tournament.name}"`,
  }));

  // Deliberately NOT revalidatePath(`/tournaments/${tournamentId}`): that
  // path is the one page a batch upload is actually happening on, and
  // revalidatePath "updates the UI immediately" for whichever path the
  // admin is currently viewing - called once per photo (PhotoUploadDialog
  // confirms each file separately via Promise.all), a multi-photo batch
  // used to re-render the whole page N times in a row while the dialog sat
  // open on top of it, visible as a jittery flicker. The dialog instead
  // calls router.refresh() itself exactly once, after the whole batch
  // settles - see photo-upload-dialog.tsx.
  revalidatePath("/gallery");
  revalidatePath(`/gallery/${parsed.data.tournamentId}`);
  return {};
}

/**
 * Makes `photoId` its tournament's cover - the picture on the /gallery card and
 * on the homepage's "Життя клубу" fallback. At most one cover per tournament,
 * so the others are cleared in the same transaction; without any cover the
 * most recently uploaded photo is used (see getTournamentsWithPhotos).
 */
export async function setTournamentCoverPhotoAction(photoId: string, request?: Request): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

  if (typeof photoId !== "string" || !photoId) {
    return { error: "Фото не знайдено" };
  }

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, tournamentId: true, tournament: { select: { name: true } } },
  });
  if (!photo) {
    return { error: "Фото не знайдено — можливо, його вже видалили" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.photo.updateMany({
        where: { tournamentId: photo.tournamentId, isCover: true, id: { not: photo.id } },
        data: { isCover: false },
      });
      await tx.photo.update({ where: { id: photo.id }, data: { isCover: true } });
    });
  } catch (error) {
    // Deleted in another tab between the lookup above and the update.
    if (isRecordNotFoundError(error)) {
      return { error: "Фото не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "photo.cover",
    entityType: "Photo",
    entityId: photo.id,
    summary: `Обкладинку турніру "${photo.tournament.name}" змінено`,
  }));

  revalidatePath(`/tournaments/${photo.tournamentId}`);
  revalidatePath(`/admin/tournaments/${photo.tournamentId}`);
  revalidatePath("/gallery");
  revalidatePath(`/gallery/${photo.tournamentId}`);
  // The homepage's "Життя клубу" falls back to these covers.
  revalidatePath("/");
  return {};
}

export async function deletePhotoAction(photoId: string, request?: Request): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

  let photo;
  try {
    photo = await prisma.photo.delete({
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
    // Best-effort, not awaited: a stray object left behind in R2 costs
    // pennies and isn't a correctness issue, so a failure here shouldn't
    // surface to the admin (mirrors logAudit's own best-effort error
    // handling) or delay the audit log write below.
    deleteObject(photo.key).catch((error) =>
      console.error("Failed to delete R2 object for photo", photo.id, photo.key, error),
    );
    return logAudit(session.user, {
      action: "photo.delete",
      entityType: "Photo",
      entityId: photo.id,
      summary: `Видалено фото з турніру "${photo.tournament.name}"`,
    });
  });

  revalidatePath(`/tournaments/${photo.tournamentId}`);
  // Photos can be deleted from the admin tournament's "Фото" tab too - without
  // this its grid would keep showing the photo that was just deleted.
  revalidatePath(`/admin/tournaments/${photo.tournamentId}`);
  revalidatePath("/gallery");
  revalidatePath(`/gallery/${photo.tournamentId}`);
  return {};
}
