"use server";

import { requireAnyDomainAdmin } from "@/lib/permissions";
import { newsPostFormSchema } from "@/lib/validation/news";
import { fieldErrorsFromZod } from "@/lib/zod-errors";
import {
  createNewsPostCore,
  updateNewsPostCore,
  deleteNewsPostCore,
  type ActionState,
} from "@/lib/actions/news-core";

export type { ActionState } from "@/lib/actions/news-core";

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

  return createNewsPostCore(session, parsed.data, photoKey);
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

  return updateNewsPostCore(session, id, parsed.data, newPhotoKey, removePhoto);
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

  return deleteNewsPostCore(session, id);
}
