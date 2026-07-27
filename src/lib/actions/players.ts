"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { playerFormSchema } from "@/lib/validation/player";

export type ActionState = { error?: string; success?: boolean };

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function createPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = playerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  try {
    await prisma.player.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Гравець з таким email вже існує" };
    }
    throw error;
  }

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function updatePlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  const parsed = playerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  try {
    await prisma.player.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Гравець з таким email вже існує" };
    }
    throw error;
  }

  revalidatePath("/admin/players");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  return { success: true };
}

export async function deletePlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  const [matchCount, entryCount] = await Promise.all([
    prisma.matchPlayer.count({ where: { playerId: id } }),
    prisma.tournamentParticipant.count({ where: { playerId: id } }),
  ]);
  if (matchCount > 0 || entryCount > 0) {
    return {
      error:
        "Гравця не можна видалити — він має історію матчів чи турнірів. Це збереже цілісність результатів.",
    };
  }

  await prisma.player.delete({ where: { id } });
  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function unlinkPlayerAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.player.update({ where: { id }, data: { userId: null } });
  revalidatePath("/admin/players");
  revalidatePath("/players");
}

export async function linkPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const playerId = formData.get("playerId");
  const userId = formData.get("userId");
  if (typeof playerId !== "string" || typeof userId !== "string" || !userId) {
    return { error: "Оберіть користувача" };
  }

  const [player, user] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  try {
    await prisma.player.update({
      where: { id: playerId },
      data: { userId, email: player?.email ?? user?.email?.toLowerCase() },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Цей користувач уже прив'язаний до іншого гравця" };
    }
    throw error;
  }

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}
