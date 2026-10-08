import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { buildPadelBracketSnapshot, CascadeResetPendingError } from "@/lib/actions/padel-bracket-snapshot";
import type { CascadeReset } from "@/lib/actions/padel-bracket-snapshot";
import { checkPadelCompletedMatchesAcknowledged } from "@/lib/actions/padel-match-randomize-shared";
import { logAudit } from "@/lib/audit";
import { computeAdvancementPropagation, sideTeamLabel } from "@/lib/bracket-advancement";
import { prisma } from "@/lib/db";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";
import { requireDomainAdmin } from "@/lib/permissions";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import { deleteObject } from "@/lib/r2";
import { schedulePadelRatingSnapshotRefresh } from "@/lib/rating/padel-snapshot";
import type { PadelTournamentFormInput } from "@/lib/validation/padel-tournament";

function cleanUpOldPhoto(key: string) {
  deleteObject(key).catch((error) => console.error("Failed to delete R2 object for padel tournament photo", key, error));
}

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

/** Padel twin of createTournamentCore (tournaments.ts) - shared by createPadelTournamentAction and POST /api/v1/padel/tournaments. */
export async function createPadelTournamentCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  data: PadelTournamentFormInput,
) {
  const tournament = await prisma.padelTournament.create({
    data: {
      name: data.name,
      description: data.description,
      format: data.format,
      status: data.status,
      isWomensOnly: data.isWomensOnly,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
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
  return tournament;
}

/** Padel twin of updateTournamentCore - shared by updatePadelTournamentAction and PATCH /api/v1/padel/tournaments/[id]. */
export async function updatePadelTournamentCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  data: PadelTournamentFormInput,
): Promise<ActionState> {
  const current = await prisma.padelTournament.findUnique({
    where: { id },
    select: { format: true, _count: { select: { matches: true } } },
  });
  if (!current) {
    return { error: "Турнір не знайдено" };
  }
  if (current.format !== data.format && current._count.matches > 0) {
    const message = "Не можна змінити формат турніру, коли в ньому вже є матчі — спершу видаліть їх.";
    return { error: message, fieldErrors: { format: message } };
  }

  try {
    await prisma.padelTournament.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        format: data.format,
        status: data.status,
        isWomensOnly: data.isWomensOnly,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
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
    summary: `Оновлено турнір (Падел) "${data.name}"`,
  }));

  revalidatePath("/admin/padel/tournaments");
  revalidatePath(`/admin/padel/tournaments/${id}`);
  revalidatePath("/padel/tournaments");
  revalidatePath(`/padel/tournaments/${id}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true };
}

type DeletePadelTournamentResult = { error: string } | { name: string };

/** Padel twin of deleteTournamentCore - shared by deletePadelTournamentAction and DELETE /api/v1/padel/tournaments/[id]. */
export async function deletePadelTournamentCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  acknowledgedCompletedLoss: boolean,
): Promise<DeletePadelTournamentResult> {
  const completedError = await checkPadelCompletedMatchesAcknowledged(id, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  // Read every photo's R2 key before deleting - see the identical comment on
  // deleteTournamentAction (tournaments.ts).
  const existing = await prisma.padelTournament.findUnique({
    where: { id },
    select: { photos: { select: { key: true } } },
  });

  let deleted;
  try {
    deleted = await prisma.padelTournament.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Турнір не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  for (const { key } of existing?.photos ?? []) cleanUpOldPhoto(key);

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
  return { name: deleted.name };
}

/** Padel twin of resetTournamentCore - shared by resetPadelTournamentAction and POST /api/v1/padel/tournaments/[id]/reset. */
export async function resetPadelTournamentCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  acknowledgedCompletedLoss: boolean,
): Promise<ActionState> {
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

export type WithdrawActionState = {
  error?: string;
  success?: boolean;
  cascadeResets?: CascadeReset[];
};

/** Padel twin of AlreadyWithdrawnError from tournaments.ts. */
class AlreadyWithdrawnError extends Error {}

/** Padel twin of withdrawParticipantCore - shared by withdrawPadelParticipantAction and POST /api/v1/padel/tournaments/[id]/participants/[playerId]/withdraw. */
export async function withdrawPadelParticipantCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  tournamentId: string,
  playerId: string,
  acknowledgedCascadeReset: boolean,
): Promise<WithdrawActionState> {
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
              return {
                matchId: r.matchId,
                round: r.round,
                sideALabel: sideTeamLabel(m, "A", nameById),
                sideBLabel: sideTeamLabel(m, "B", nameById),
              };
            }),
          );
        }

        for (const fill of propagation.fills) {
          await tx.padelMatchPlayer.deleteMany({ where: { matchId: fill.matchId, side: fill.side } });
          if (fill.playerIds.length > 0) {
            await tx.padelMatchPlayer.createMany({
              data: fill.playerIds.map((playerId) => ({ matchId: fill.matchId, side: fill.side, playerId })),
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