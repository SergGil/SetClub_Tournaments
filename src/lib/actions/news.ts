"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import { newsPostFormSchema } from "@/lib/validation/news";

export type ActionState = { error?: string; success?: boolean };

export async function createNewsPostAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const parsed = newsPostFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  const post = await prisma.newsPost.create({
    data: { ...parsed.data, authorId: session.user.id },
  });

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
  const session = await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Новину не знайдено" };
  }

  const parsed = newsPostFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  try {
    await prisma.newsPost.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Новину не знайдено — можливо, її вже видалили" };
    }
    throw error;
  }

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
  const session = await requireAdmin();

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
