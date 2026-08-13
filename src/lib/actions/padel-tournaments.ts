"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { buildPadelBracketSnapshot, CascadeResetPendingError } from "@/lib/actions/padel-bracket-snapshot";
import type { CascadeReset } from "@/lib/actions/padel-bracket-snapshot";
import { checkPadelCompletedMatchesAcknowledged } from "@/lib/actions/padel-match-randomize-shared";
import { logAudit } from "@/lib/audit";
import { computeAdvancementPropagation } from "@/lib/bracket-advancement";
import { prisma } from "@/lib/db";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";
import { requireDomainAdmin } from "@/lib/permissions";
import { isForeignKeyError, isRecordNotFoundError, uniqueConstraintTarget } from "@/lib/prisma-errors";
import { MAX_TOURNAMENT_GROUPS } from "@/lib/randomize-pairs";
import { schedulePadelRatingSnapshotRefresh } from "@/lib/rating/padel-snapshot";
import { padelTournamentFormSchema } from "@/lib/validation/padel-tournament";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

export async function createPadelTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const parsed = padelTournamentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    format: formData.get("format"),
    status: formData.get("status"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const tournament = await prisma.padelTournament.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      format: parsed.data.format,
      status: parsed.data.status,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      createdById: session.user.id,
    },
  });

  after(() => logAudit(session.user, {
    action: "padel.tournament.create",
    entityType: "PadelTournament",
    entityId: tournament.id,
    summary: `Створено турнір (Падел) "${tournament.name}"`,
  }));

  revalidatePath("/admin/padel/tournaments");
  revalidatePath("/padel/tournaments");
  redirect(`/admin/padel/tournaments/${tournament.id}`);
}

export async function updatePadelTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Турнір не знайдено" };
  }

  const parsed = padelTournamentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    format: formData.get("format"),
    status: formData.get("status"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const current = await prisma.padelTournament.findUnique({
    where: { id },
    select: { format: true, _count: { select: { matches: true } } },
  });
  if (!current) {
    return { error: "Турнір не знайдено" };
  }
  if (current.format !== parsed.data.format && current._count.matches > 0) {
    const message = "Не можна змінити формат турніру, коли в ньому вже є матчі — спершу видаліть їх.";
    return { error: message, fieldErrors: { format: message } };
  }

  try {
    await prisma.padelTournament.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        format: parsed.data.format,
        status: parsed.data.status,
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
    action: "padel.tournament.update",
    entityType: "PadelTournament",
    entityId: id,
    summary: `Оновлено турнір (Падел) "${parsed.data.name}"`,
  }));

  revalidatePath("/admin/padel/tournaments");
  revalidatePath(`/admin/padel/tournaments/${id}`);
  revalidatePath("/padel/tournaments");
  revalidatePath(`/padel/tournaments/${id}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true };
}

export async function deletePadelTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Турнір не знайдено" };
  }

  const acknowledgedCompletedLoss = formData.get("acknowledgedCompletedLoss") === "true";
  const completedError = await checkPadelCompletedMatchesAcknowledged(id, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  let deleted;
  try {
    deleted = await prisma.padelTournament.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Турнір не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.tournament.delete",
    entityType: "PadelTournament",
    entityId: id,
    summary: `Видалено турнір (Падел) "${deleted.name}"`,
  }));

  revalidatePath("/admin/padel/tournaments");
  revalidatePath("/padel/tournaments");
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  redirect("/admin/padel/tournaments");
}

/** Padel twin of resetTournamentAction - see its doc comment for the full rationale. */
export async function resetPadelTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Турнір не знайдено" };
  }

  const acknowledgedCompletedLoss = formData.get("acknowledgedCompletedLoss") === "true";
  const completedError = await checkPadelCompletedMatchesAcknowledged(id, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const tournament = await prisma.padelTournament.findUnique({ where: { id }, select: { name: true } });
  if (!tournament) {
    return { error: "Турнір не знайдено — можливо, його вже видалили" };
  }

  await prisma.$transaction([
    prisma.padelMatch.deleteMany({ where: { tournamentId: id } }),
    prisma.padelTournamentGroup.deleteMany({ where: { tournamentId: id } }),
    prisma.padelTournamentParticipant.updateMany({ where: { tournamentId: id }, data: { group: null } }),
  ]);

  after(() => logAudit(session.user, {
    action: "padel.tournament.reset",
    entityType: "PadelTournament",
    entityId: id,
    summary: `Обнулено турнір (Падел) "${tournament.name}" — видалено матчі й розподіл по групах`,
  }));

  revalidatePath(`/admin/padel/tournaments/${id}`);
  revalidatePath(`/padel/tournaments/${id}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true };
}

export async function addPadelParticipantAction(
  tournamentId: string,
  playerIds: string[],
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL");

  if (playerIds.length === 0) {
    return { error: "Оберіть хоча б одного гравця" };
  }

  try {
    await prisma.$transaction(
      playerIds.map((playerId) =>
        prisma.padelTournamentParticipant.upsert({
          where: { tournamentId_playerId: { tournamentId, playerId } },
          update: {},
          create: { tournamentId, playerId },
        }),
      ),
    );
  } catch (error) {
    if (isForeignKeyError(error)) {
      return { error: "Турнір або гравець не знайдено — можливо, їх вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.tournament.participant.add",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Додано ${playerIds.length} учасник(ів) до турніру (Падел)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return {};
}

export async function removePadelParticipantAction(
  tournamentId: string,
  playerId: string,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL");

  const { count } = await prisma.padelTournamentParticipant.deleteMany({
    where: {
      tournamentId,
      playerId,
      player: { padelMatchAppearances: { none: { match: { tournamentId } } } },
    },
  });
  if (count === 0) {
    return { error: "Учасника не можна прибрати — він уже має матчі в цьому турнірі." };
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true } });

  after(() => logAudit(session.user, {
    action: "padel.tournament.participant.remove",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Видалено учасника ${player?.name ?? playerId} з турніру (Падел)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return {};
}

export type WithdrawActionState = {
  error?: string;
  success?: boolean;
  cascadeResets?: CascadeReset[];
};

/** Padel twin of AlreadyWithdrawnError from tournaments.ts. */
class AlreadyWithdrawnError extends Error {}

/**
 * Padel twin of withdrawParticipantAction - see its doc comment for the
 * full rationale (bulk-withdraws a SINGLES/MIXED participant, closes
 * SCHEDULED matches as walkovers, DOUBLES unsupported).
 */
export async function withdrawPadelParticipantAction(
  _prevState: WithdrawActionState,
  formData: FormData,
): Promise<WithdrawActionState> {
  const session = await requireDomainAdmin("PADEL");

  const tournamentId = formData.get("tournamentId");
  const playerId = formData.get("playerId");
  if (typeof tournamentId !== "string" || !tournamentId || typeof playerId !== "string" || !playerId) {
    return { error: "Турнір або гравця не знайдено" };
  }
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  const [tournament, participant] = await Promise.all([
    prisma.padelTournament.findUnique({ where: { id: tournamentId }, select: { format: true } }),
    prisma.padelTournamentParticipant.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      select: { withdrawnAt: true, player: { select: { name: true } } },
    }),
  ]);
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format === "DOUBLES") {
    return { error: "Зняття з турніру поки не підтримується для парних турнірів" };
  }
  if (!participant) return { error: "Учасника не знайдено — можливо, його вже прибрали з турніру" };
  if (participant.withdrawnAt) return { error: "Гравця вже знято з турніру" };

  let closedMatchCount = 0;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 1)`;

      const { count } = await tx.padelTournamentParticipant.updateMany({
        where: { tournamentId, playerId, withdrawnAt: null },
        data: { withdrawnAt: new Date() },
      });
      if (count === 0) throw new AlreadyWithdrawnError();

      const scheduledMatches = await tx.padelMatch.findMany({
        where: { tournamentId, status: "SCHEDULED", players: { some: { playerId } } },
        select: { id: true, players: { select: { side: true, playerId: true } } },
      });

      const closedMatchIds: string[] = [];
      for (const match of scheduledMatches) {
        const opponent = match.players.find((p) => p.playerId !== playerId);
        if (match.players.length === 2 && opponent) {
          await tx.padelMatch.update({
            where: { id: match.id },
            data: {
              status: "COMPLETED",
              winnerSide: opponent.side,
              walkover: true,
              completedAt: new Date(),
            },
          });
          closedMatchIds.push(match.id);
        } else {
          await tx.padelMatchPlayer.deleteMany({ where: { matchId: match.id, playerId } });
        }
      }
      closedMatchCount = closedMatchIds.length;

      const hasAdvancements = (await tx.padelMatchAdvancement.count({ where: { tournamentId } })) > 0;
      if (!hasAdvancements || closedMatchIds.length === 0) return;

      for (const matchId of closedMatchIds) {
        const snapshot = await buildPadelBracketSnapshot(tx, tournamentId);
        const propagation = computeAdvancementPropagation(snapshot, matchId);

        if (propagation.resets.length > 0 && !acknowledgedCascadeReset) {
          const nameById = new Map(snapshot.participants.map((p) => [p.playerId, p.name]));
          const matchById = new Map(snapshot.matches.map((m) => [m.id, m]));
          throw new CascadeResetPendingError(
            propagation.resets.map((r) => {
              const m = matchById.get(r.matchId);
              const sideA = m?.players.find((p) => p.side === "A");
              const sideB = m?.players.find((p) => p.side === "B");
              return {
                matchId: r.matchId,
                round: r.round,
                sideALabel: sideA ? (nameById.get(sideA.playerId) ?? "?") : "?",
                sideBLabel: sideB ? (nameById.get(sideB.playerId) ?? "?") : "?",
              };
            }),
          );
        }

        for (const fill of propagation.fills) {
          await tx.padelMatchPlayer.deleteMany({ where: { matchId: fill.matchId, side: fill.side } });
          if (fill.playerId) {
            await tx.padelMatchPlayer.create({
              data: { matchId: fill.matchId, side: fill.side, playerId: fill.playerId },
            });
          }
        }
        const resetMatchIds = [...new Set(propagation.resets.map((r) => r.matchId))];
        if (resetMatchIds.length > 0) {
          await tx.padelMatchSet.deleteMany({ where: { matchId: { in: resetMatchIds } } });
          await tx.padelMatch.updateMany({
            where: { id: { in: resetMatchIds } },
            data: { status: "SCHEDULED", winnerSide: null, completedAt: null, retired: false },
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof CascadeResetPendingError) {
      return {
        error: "Зняття скине рахунок матчів нижче по сітці — підтвердьте скид, щоб продовжити.",
        cascadeResets: error.resets,
      };
    }
    if (error instanceof AlreadyWithdrawnError) {
      return { error: "Гравця вже знято з турніру" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.tournament.participant.withdraw",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Знято з турніру (Падел) гравця ${participant.player.name} — технічна поразка у ${closedMatchCount} матч(ах)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true };
}

export async function togglePadelParticipantSeedAction(
  tournamentId: string,
  playerId: string,
  seeded: boolean,
) {
  const session = await requireDomainAdmin("PADEL");
  let updated;
  try {
    updated = await prisma.padelTournamentParticipant.update({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      data: { seed: seeded ? 1 : null },
      include: { player: { select: { name: true } } },
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) return;
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.tournament.participant.seed",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `${seeded ? "Позначено сіяним" : "Знято позначку сіяного"} гравця ${updated.player.name} (Падел)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
}

export async function setPadelParticipantGroupAction(
  tournamentId: string,
  playerId: string,
  group: number | null,
) {
  const session = await requireDomainAdmin("PADEL");
  if (group !== null && (!Number.isInteger(group) || group < 1 || group > MAX_TOURNAMENT_GROUPS)) {
    return { error: "Некоректний номер групи" };
  }

  try {
    await prisma.padelTournamentParticipant.update({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      data: { group },
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) return;
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.tournament.participant.group",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `${group ? `Призначено групу ${group}` : "Знято групу"} гравцю ${playerId} (Падел)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
}

/** Padel twin of createTournamentGroupAction - see its doc comment for the full rationale. */
export async function createPadelTournamentGroupAction(
  tournamentId: string,
  name: string,
  playerIds: string[] = [],
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL");

  const trimmed = name.trim();
  if (!trimmed) return { error: "Вкажіть назву групи" };
  if (trimmed.length > 50) return { error: "Назва групи занадто довга (максимум 50 символів)" };

  const [participantMax, groupMax, participants] = await Promise.all([
    prisma.padelTournamentParticipant.aggregate({ where: { tournamentId }, _max: { group: true } }),
    prisma.padelTournamentGroup.aggregate({ where: { tournamentId }, _max: { number: true } }),
    prisma.padelTournamentParticipant.findMany({ where: { tournamentId }, select: { playerId: true } }),
  ]);
  const rosterIds = new Set(participants.map((p) => p.playerId));
  if (!playerIds.every((id) => rosterIds.has(id))) {
    return { error: "Гравець не зареєстрований у цьому турнірі" };
  }
  const nextNumber =
    1 + Math.max(MAX_TOURNAMENT_GROUPS, participantMax._max.group ?? 0, groupMax._max.number ?? 0);
  const groupId = randomUUID();

  try {
    await prisma.$transaction([
      prisma.padelTournamentGroup.create({
        data: { id: groupId, tournamentId, number: nextNumber, name: trimmed },
      }),
      ...(playerIds.length > 0
        ? [
            prisma.padelTournamentGroupMember.createMany({
              data: playerIds.map((playerId) => ({ tournamentGroupId: groupId, playerId })),
            }),
          ]
        : []),
    ]);
  } catch (error) {
    const target = uniqueConstraintTarget(error);
    if (target) {
      return {
        error: target.includes("number")
          ? "Групу з таким номером щойно створили в іншому місці — спробуйте ще раз"
          : "Один із гравців обраний двічі",
      };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.tournament.group.create",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Додано групу «${trimmed}» (Падел)${playerIds.length > 0 ? ` (${playerIds.length} гравців)` : ""}`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  return {};
}

/** Padel twin of updateTournamentGroupAction - see its doc comment for the full rationale. */
export async function updatePadelTournamentGroupAction(
  tournamentId: string,
  groupId: string,
  name: string,
  playerIds: string[] = [],
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL");

  const trimmed = name.trim();
  if (!trimmed) return { error: "Вкажіть назву групи" };
  if (trimmed.length > 50) return { error: "Назва групи занадто довга (максимум 50 символів)" };

  const [group, participants] = await Promise.all([
    prisma.padelTournamentGroup.findUnique({ where: { id: groupId }, select: { tournamentId: true } }),
    prisma.padelTournamentParticipant.findMany({ where: { tournamentId }, select: { playerId: true } }),
  ]);
  if (!group || group.tournamentId !== tournamentId) {
    return { error: "Групу не знайдено — можливо, її вже видалили" };
  }
  const rosterIds = new Set(participants.map((p) => p.playerId));
  if (!playerIds.every((id) => rosterIds.has(id))) {
    return { error: "Гравець не зареєстрований у цьому турнірі" };
  }

  try {
    await prisma.$transaction([
      prisma.padelTournamentGroup.update({ where: { id: groupId }, data: { name: trimmed } }),
      prisma.padelTournamentGroupMember.deleteMany({ where: { tournamentGroupId: groupId } }),
      ...(playerIds.length > 0
        ? [
            prisma.padelTournamentGroupMember.createMany({
              data: playerIds.map((playerId) => ({ tournamentGroupId: groupId, playerId })),
            }),
          ]
        : []),
    ]);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Групу не знайдено — можливо, її вже видалили" };
    }
    if (uniqueConstraintTarget(error)) {
      return { error: "Один із гравців обраний двічі" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.tournament.group.update",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Оновлено групу «${trimmed}» (Падел)${playerIds.length > 0 ? ` (${playerIds.length} гравців)` : ""}`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  return {};
}

/** Padel twin of deleteTournamentGroupAction. */
export async function deletePadelTournamentGroupAction(
  tournamentId: string,
  groupId: string,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL");

  const group = await prisma.padelTournamentGroup.findUnique({
    where: { id: groupId },
    select: { tournamentId: true, name: true },
  });
  if (!group || group.tournamentId !== tournamentId) {
    return { error: "Групу не знайдено — можливо, її вже видалили" };
  }

  await prisma.padelTournamentGroup.delete({ where: { id: groupId } });

  after(() => logAudit(session.user, {
    action: "padel.tournament.group.delete",
    entityType: "PadelTournament",
    entityId: tournamentId,
    summary: `Видалено групу «${group.name}» (Падел)`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  return {};
}
