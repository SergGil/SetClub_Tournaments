"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
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

  await prisma.newsPost.create({
    data: { ...parsed.data, authorId: session.user.id },
  });

  revalidatePath("/admin/news");
  revalidatePath("/");
  return { success: true };
}

export async function updateNewsPostAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

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

  await prisma.newsPost.update({ where: { id }, data: parsed.data });

  revalidatePath("/admin/news");
  revalidatePath("/");
  return { success: true };
}

export async function deleteNewsPostAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Новину не знайдено" };
  }

  await prisma.newsPost.delete({ where: { id } });

  revalidatePath("/admin/news");
  revalidatePath("/");
  return { success: true };
}
