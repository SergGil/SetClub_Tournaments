"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { playerFormSchema } from "@/lib/validation/player";

export type ActionState = { error?: string; success?: boolean };

function isUniqueConstraintError(error: unknown): boolean {
  return uniqueConstraintTarget(error) !== null;
}

/** Player has two separate unique columns (email, userId) - returns which one a P2002 hit, or null if not a unique-constraint error. */
function uniqueConstraintTarget(error: unknown): string[] | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code?: string }).code !== "P2002"
  ) {
    return null;
  }
  return (error as { meta?: { target?: string[] } }).meta?.target ?? [];
}

export async function createPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = playerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    gender: formData.get("gender"),
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
    gender: formData.get("gender"),
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

  // A single conditional delete, atomic at the DB level: the "has no history"
  // check and the delete happen as one statement, so a match/entry created
  // between a separate check and delete can't slip through and get cascaded away.
  const { count } = await prisma.player.deleteMany({
    where: { id, matchAppearances: { none: {} }, tournamentEntries: { none: {} } },
  });
  if (count === 0) {
    const exists = await prisma.player.findUnique({ where: { id }, select: { id: true } });
    return {
      error: exists
        ? "Гравця не можна видалити — він має історію матчів чи турнірів. Це збереже цілісність результатів."
        : "Гравця не знайдено",
    };
  }

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function unlinkPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  await prisma.player.update({ where: { id }, data: { userId: null } });
  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
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
    const target = uniqueConstraintTarget(error);
    if (target) {
      return {
        error: target.includes("email")
          ? "Email цього користувача вже належить іншому гравцю"
          : "Цей користувач уже прив'язаний до іншого гравця",
      };
    }
    throw error;
  }

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}
