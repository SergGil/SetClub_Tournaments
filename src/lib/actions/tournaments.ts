"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { checkCompletedMatchesAcknowledged } from "@/lib/actions/matches";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import { MAX_TOURNAMENT_GROUPS } from "@/lib/randomize-pairs";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";
import { tournamentFormSchema } from "@/lib/validation/tournament";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

export async function createTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const parsed = tournamentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    format: formData.get("format"),
    status: formData.get("status"),
    surface: formData.get("surface"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const tournament = await prisma.tournament.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      format: parsed.data.format,
      status: parsed.data.status,
      surface: parsed.data.surface,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      createdById: session.user.id,
    },
  });

  after(() => logAudit(session.user, {
    action: "tournament.create",
    entityType: "Tournament",
    entityId: tournament.id,
    summary: `Створено турнір "${tournament.name}"`,
  }));

  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  redirect(`/admin/tournaments/${tournament.id}`);
}

export async function updateTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Турнір не знайдено" };
  }

  const parsed = tournamentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    format: formData.get("format"),
    status: formData.get("status"),
    surface: formData.get("surface"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const current = await prisma.tournament.findUnique({
    where: { id },
    select: { format: true, _count: { select: { matches: true } } },
  });
  if (!current) {
    return { error: "Турнір не знайдено" };
  }
  // Standings and the match dialog both key off tournament.format (e.g. doubles
  // are ranked by team, singles by player). Changing it out from under existing
  // matches would silently misinterpret their results, so block it instead.
  // The form is also expected to disable the format Select client-side once
  // matches exist (see TournamentForm) - this is the server-side backstop.
  if (current.format !== parsed.data.format && current._count.matches > 0) {
    const message = "Не можна змінити формат турніру, коли в ньому вже є матчі — спершу видаліть їх.";
    return { error: message, fieldErrors: { format: message } };
  }

  try {
    await prisma.tournament.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        format: parsed.data.format,
        status: parsed.data.status,
        surface: parsed.data.surface,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      },
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Турнір не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "tournament.update",
    entityType: "Tournament",
    entityId: id,
    summary: `Оновлено турнір "${parsed.data.name}"`,
  }));

  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${id}`);
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${id}`);
  // startDate drives Glicko-2's period ordering and every rating-period
  // boundary in RatingSnapshot (src/lib/rating/engine.ts) - editing it after
  // matches exist can reorder history, so keep ratings in sync same as every
  // other mutation that can move the "when" of a match.
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}

export async function deleteTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Турнір не знайдено" };
  }

  const acknowledgedCompletedLoss = formData.get("acknowledgedCompletedLoss") === "true";
  const completedError = await checkCompletedMatchesAcknowledged(id, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  let deleted;
  try {
    deleted = await prisma.tournament.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Турнір не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "tournament.delete",
    entityType: "Tournament",
    entityId: id,
    summary: `Видалено турнір "${deleted.name}"`,
  }));

  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  redirect("/admin/tournaments");
}

export async function addParticipantAction(
  tournamentId: string,
  playerIds: string[],
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  if (playerIds.length === 0) {
    return { error: "Оберіть хоча б одного гравця" };
  }

  await prisma.$transaction(
    playerIds.map((playerId) =>
      prisma.tournamentParticipant.upsert({
        where: { tournamentId_playerId: { tournamentId, playerId } },
        update: {},
        create: { tournamentId, playerId },
      }),
    ),
  );

  after(() => logAudit(session.user, {
    action: "tournament.participant.add",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Додано ${playerIds.length} учасник(ів) до турніру`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  // Set Club's field-size bonus reads the roster size off already-recorded
  // matches (src/lib/rating/ratings-data.ts), so adding a participant after
  // matches were played can change past points - keep /rating in sync.
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return {};
}

export async function removeParticipantAction(
  tournamentId: string,
  playerId: string,
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  // Only remove the entry if the player has no matches in this tournament -
  // otherwise they'd vanish from the standings while opponents still show
  // wins/losses (and head-to-head) against them.
  const { count } = await prisma.tournamentParticipant.deleteMany({
    where: {
      tournamentId,
      playerId,
      player: { matchAppearances: { none: { match: { tournamentId } } } },
    },
  });
  if (count === 0) {
    return { error: "Учасника не можна прибрати — він уже має матчі в цьому турнірі." };
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true } });

  after(() => logAudit(session.user, {
    action: "tournament.participant.remove",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Видалено учасника ${player?.name ?? playerId} з турніру`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return {};
}

export async function toggleParticipantSeedAction(
  tournamentId: string,
  playerId: string,
  seeded: boolean,
) {
  const session = await requireAdmin();
  let updated;
  try {
    updated = await prisma.tournamentParticipant.update({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      data: { seed: seeded ? 1 : null },
      include: { player: { select: { name: true } } },
    });
  } catch (error) {
    // Participant was removed concurrently (e.g. another admin's
    // removeParticipantAction) - nothing left to seed, so just no-op
    // instead of surfacing a raw P2025 to the client.
    if (isRecordNotFoundError(error)) return;
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "tournament.participant.seed",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `${seeded ? "Позначено сіяним" : "Знято позначку сіяного"} гравця ${updated.player.name}`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  // Doubles OpenSkill and Set Club both weight/split credit by seed status
  // (src/lib/rating/ratings-data.ts), so flipping it after matches are
  // already recorded can change past ratings - keep /rating in sync.
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
}

export async function setParticipantGroupAction(
  tournamentId: string,
  playerId: string,
  group: number | null,
) {
  const session = await requireAdmin();
  if (group !== null && (!Number.isInteger(group) || group < 1 || group > MAX_TOURNAMENT_GROUPS)) {
    return { error: "Некоректний номер групи" };
  }

  try {
    await prisma.tournamentParticipant.update({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      data: { group },
    });
  } catch (error) {
    // Participant was removed concurrently - nothing left to group.
    if (isRecordNotFoundError(error)) return;
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "tournament.participant.group",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `${group ? `Призначено групу ${group}` : "Знято групу"} гравцю ${playerId}`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
}
