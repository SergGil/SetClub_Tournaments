"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainsAdmin } from "@/lib/permissions";
import {
  isForeignKeyError,
  isRecordNotFoundError,
  isUniqueConstraintError,
  uniqueConstraintTarget,
} from "@/lib/prisma-errors";
import { playerFormSchema } from "@/lib/validation/player";
import type { PlayerFormInput } from "@/lib/validation/player";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

/** Shared by createPlayerAction (web form) and POST /api/v1/players (mobile) - see docs/MOBILE_API.md. */
export async function createPlayerCore(
  session: Awaited<ReturnType<typeof requireDomainsAdmin>>,
  data: PlayerFormInput,
): Promise<ActionState> {
  let player;
  try {
    player = await prisma.player.create({ data });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Гравець з таким email вже існує", fieldErrors: { email: "Такий email вже зайнятий" } };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "player.create",
    entityType: "Player",
    entityId: player.id,
    summary: `Створено гравця "${player.name}"`,
  }));

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function createPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const parsed = playerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    gender: formData.get("gender"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  return createPlayerCore(session, parsed.data);
}

/** Shared by updatePlayerAction (web form) and PATCH /api/v1/players/[id] (mobile) - see docs/MOBILE_API.md. */
export async function updatePlayerCore(
  session: Awaited<ReturnType<typeof requireDomainsAdmin>>,
  id: string,
  data: PlayerFormInput,
): Promise<ActionState> {
  try {
    await prisma.player.update({ where: { id }, data });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Гравець з таким email вже існує", fieldErrors: { email: "Такий email вже зайнятий" } };
    }
    if (isRecordNotFoundError(error)) {
      return { error: "Гравця не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "player.update",
    entityType: "Player",
    entityId: id,
    summary: `Оновлено гравця "${data.name}"`,
  }));

  revalidatePath("/admin/players");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  return { success: true };
}

export async function updatePlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  const parsed = playerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    gender: formData.get("gender"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  return updatePlayerCore(session, id, parsed.data);
}

/** Shared by deletePlayerAction (web form) and DELETE /api/v1/players/[id] (mobile) - see docs/MOBILE_API.md. */
export async function deletePlayerCore(
  session: Awaited<ReturnType<typeof requireDomainsAdmin>>,
  id: string,
): Promise<ActionState> {
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

  after(() => logAudit(session.user, {
    action: "player.delete",
    entityType: "Player",
    entityId: id,
    summary: `Видалено гравця "${existing?.name ?? id}"`,
  }));

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function deletePlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  return deletePlayerCore(session, id);
}

/** Shared by unlinkPlayerAction (web form) and POST /api/v1/players/[id]/unlink (mobile) - see docs/MOBILE_API.md. */
export async function unlinkPlayerCore(
  session: Awaited<ReturnType<typeof requireDomainsAdmin>>,
  id: string,
): Promise<ActionState> {
  let player;
  try {
    player = await prisma.player.update({ where: { id }, data: { userId: null } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Гравця не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "player.unlink",
    entityType: "Player",
    entityId: id,
    summary: `Відв'язано акаунт від гравця "${player.name}"`,
  }));

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function unlinkPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Гравця не знайдено" };
  }

  return unlinkPlayerCore(session, id);
}

/** Shared by linkPlayerAction (web form) and POST /api/v1/players/[id]/link (mobile) - see docs/MOBILE_API.md. */
export async function linkPlayerCore(
  session: Awaited<ReturnType<typeof requireDomainsAdmin>>,
  playerId: string,
  userId: string,
): Promise<ActionState> {
  const [player, user] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  // The admin's user list could be stale (opened before the account was
  // deleted/unlinked elsewhere) - without this check, prisma.player.update
  // below would throw an unhandled P2003 instead of the same kind of
  // friendly error every sibling action returns for a bad reference.
  if (!user) {
    return { error: "Користувача не знайдено — можливо, обліковий запис видалили" };
  }

  let updated;
  try {
    updated = await prisma.player.update({
      where: { id: playerId },
      data: { userId, email: player?.email ?? user.email?.toLowerCase() },
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
    // Same-request race: the user was deleted between the check above and
    // this write.
    if (isForeignKeyError(error)) {
      return { error: "Користувача не знайдено — можливо, обліковий запис видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "player.link",
    entityType: "Player",
    entityId: playerId,
    summary: `Прив'язано акаунт (${user?.email ?? userId}) до гравця "${updated.name}"`,
  }));

  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { success: true };
}

export async function linkPlayerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"]);

  const playerId = formData.get("playerId");
  const userId = formData.get("userId");
  if (typeof playerId !== "string" || typeof userId !== "string" || !userId) {
    return { error: "Оберіть користувача" };
  }

  return linkPlayerCore(session, playerId, userId);
}
