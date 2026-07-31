"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { isRecordNotFoundError, isUniqueConstraintError, uniqueConstraintTarget } from "@/lib/prisma-errors";
import { playerFormSchema } from "@/lib/validation/player";

export type ActionState = { error?: string; success?: boolean };

export async function createPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const parsed = playerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    gender: formData.get("gender"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  let player;
  try {
    player = await prisma.player.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Гравець з таким email вже існує" };
    }
    throw error;
  }

  await logAudit(session.user, {
    action: "player.create",
    entityType: "Player",
    entityId: player.id,
    summary: `Створено гравця "${player.name}"`,
  });

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function updatePlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

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
    if (isRecordNotFoundError(error)) {
      return { error: "Гравця не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  await logAudit(session.user, {
    action: "player.update",
    entityType: "Player",
    entityId: id,
    summary: `Оновлено гравця "${parsed.data.name}"`,
  });

  revalidatePath("/admin/players");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  return { success: true };
}

export async function deletePlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  // Read the name before deleting for the audit log - deleteMany below
  // returns only a row count, not the deleted row(s).
  const existing = await prisma.player.findUnique({ where: { id }, select: { name: true } });

  // A single conditional delete, atomic at the DB level: the "has no history"
  // check and the delete happen as one statement, so a match/entry created
  // between a separate check and delete can't slip through and get cascaded away.
  const { count } = await prisma.player.deleteMany({
    where: { id, matchAppearances: { none: {} }, tournamentEntries: { none: {} } },
  });
  if (count === 0) {
    return {
      error: existing
        ? "Гравця не можна видалити — він має історію матчів чи турнірів. Це збереже цілісність результатів."
        : "Гравця не знайдено",
    };
  }

  await logAudit(session.user, {
    action: "player.delete",
    entityType: "Player",
    entityId: id,
    summary: `Видалено гравця "${existing?.name ?? id}"`,
  });

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function unlinkPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  let player;
  try {
    player = await prisma.player.update({ where: { id }, data: { userId: null } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Гравця не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  await logAudit(session.user, {
    action: "player.unlink",
    entityType: "Player",
    entityId: id,
    summary: `Відв'язано акаунт від гравця "${player.name}"`,
  });

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function linkPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const playerId = formData.get("playerId");
  const userId = formData.get("userId");
  if (typeof playerId !== "string" || typeof userId !== "string" || !userId) {
    return { error: "Оберіть користувача" };
  }

  const [player, user] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  let updated;
  try {
    updated = await prisma.player.update({
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
    if (isRecordNotFoundError(error)) {
      return { error: "Гравця не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  await logAudit(session.user, {
    action: "player.link",
    entityType: "Player",
    entityId: playerId,
    summary: `Прив'язано акаунт (${user?.email ?? userId}) до гравця "${updated.name}"`,
  });

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}
