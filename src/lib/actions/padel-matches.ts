"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { buildPadelBracketSnapshot, CascadeResetPendingError } from "@/lib/actions/padel-bracket-snapshot";
import type { CascadeReset } from "@/lib/actions/padel-bracket-snapshot";
import { logAudit } from "@/lib/audit";
import { computeAdvancementPropagation } from "@/lib/bracket-advancement";
import type { TournamentBracketSnapshot } from "@/lib/bracket-advancement";
import { prisma } from "@/lib/db";
import { determineMatchWinner } from "@/lib/match-result";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";
import { requireDomainAdmin } from "@/lib/permissions";
import { PLACEMENT_ROUNDS } from "@/lib/playoff-rounds";
import {
  isForeignKeyError,
  isRecordNotFoundError,
  isUniqueConstraintError,
  uniqueConstraintTarget,
} from "@/lib/prisma-errors";
import { schedulePadelRatingSnapshotRefresh } from "@/lib/rating/padel-snapshot";
// Padel courts use the same set/game/tiebreak scoring rules as Tennis, and
// matchFormSchema/scoreFormSchema have zero Prisma-model coupling (plain
// shape/business-rule validation) - reused as-is rather than cloned.
import { matchFormSchema, scoreFormSchema } from "@/lib/validation/match";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

/** See the identical helper in matches.ts for the full Base UI Select rationale. */
function nonEmptyFormValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}

export type ActionState = {
  error?: string;
  success?: boolean;
  notice?: string;
  fieldErrors?: Record<string, string>;
  cascadeResets?: CascadeReset[];
};

/** Padel twin of findDuplicatePlacementRoundError - reuses the same PLACEMENT_ROUNDS list (src/lib/playoff-rounds.ts), a sport-agnostic set of round labels. */
async function findDuplicatePlacementRoundError(
  tournamentId: string,
  round: string | null,
  excludeMatchId?: string,
): Promise<string | null> {
  if (!round || !(PLACEMENT_ROUNDS as readonly string[]).includes(round)) return null;
  const duplicate = await prisma.padelMatch.findFirst({
    where: {
      tournamentId,
      round,
      ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
    },
    select: { id: true },
  });
  return duplicate ? `У цьому турнірі вже є матч з раундом «${round}»` : null;
}

export async function createPadelMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const parsed = matchFormSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    matchType: formData.get("matchType"),
    round: formData.get("round"),
    scheduledDate: formData.get("scheduledDate"),
    sideAPlayerIds: nonEmptyFormValues(formData, "sideAPlayerIds"),
    sideBPlayerIds: nonEmptyFormValues(formData, "sideBPlayerIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  const { tournamentId, matchType, round, scheduledDate, sideAPlayerIds, sideBPlayerIds } =
    parsed.data;

  const participants = await prisma.padelTournamentParticipant.findMany({
    where: { tournamentId },
    select: { playerId: true },
  });
  const rosterIds = new Set(participants.map((p) => p.playerId));
  const allPlayerIds = [...sideAPlayerIds, ...sideBPlayerIds];
  if (!allPlayerIds.every((id) => rosterIds.has(id))) {
    return { error: "Гравець не зареєстрований у цьому турнірі" };
  }

  const duplicateRoundError = await findDuplicatePlacementRoundError(tournamentId, round);
  if (duplicateRoundError) {
    return { error: duplicateRoundError };
  }

  let created;
  try {
    created = await prisma.padelMatch.create({
      data: {
        tournamentId,
        matchType,
        round,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        players: {
          create: [
            ...sideAPlayerIds.map((playerId) => ({ side: "A" as const, playerId })),
            ...sideBPlayerIds.map((playerId) => ({ side: "B" as const, playerId })),
          ],
        },
      },
    });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return { error: "Турнір або гравець не знайдено — можливо, їх вже видалили" };
    }
    if (isUniqueConstraintError(error) && uniqueConstraintTarget(error)?.includes("round")) {
      return { error: `У цьому турнірі вже є матч з раундом «${round}»` };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.match.create",
    entityType: "PadelMatch",
    entityId: created.id,
    summary: `Створено матч (Падел, ${matchType}) у турнірі ${tournamentId}`,
  }));

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true };
}

export async function updatePadelMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Матч не знайдено" };
  }

  const parsed = matchFormSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    matchType: formData.get("matchType"),
    round: formData.get("round"),
    scheduledDate: formData.get("scheduledDate"),
    sideAPlayerIds: nonEmptyFormValues(formData, "sideAPlayerIds"),
    sideBPlayerIds: nonEmptyFormValues(formData, "sideBPlayerIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  const { matchType, round, scheduledDate, sideAPlayerIds, sideBPlayerIds } = parsed.data;

  const currentMatch = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    select: { tournamentId: true },
  });
  if (!currentMatch) {
    return { error: "Матч не знайдено — можливо, його вже видалили" };
  }

  const participants = await prisma.padelTournamentParticipant.findMany({
    where: { tournamentId: currentMatch.tournamentId },
    select: { playerId: true },
  });
  const rosterIds = new Set(participants.map((p) => p.playerId));
  const allPlayerIds = [...sideAPlayerIds, ...sideBPlayerIds];
  if (!allPlayerIds.every((id) => rosterIds.has(id))) {
    return { error: "Гравець не зареєстрований у цьому турнірі" };
  }

  const duplicateRoundError = await findDuplicatePlacementRoundError(
    currentMatch.tournamentId,
    round,
    matchId,
  );
  if (duplicateRoundError) {
    return { error: duplicateRoundError };
  }

  const currentPlayers = await prisma.padelMatchPlayer.findMany({
    where: { matchId },
    select: { side: true, playerId: true },
  });
  const currentKey = currentPlayers
    .map((p) => `${p.side}:${p.playerId}`)
    .sort()
    .join(",");
  const newKey = [
    ...sideAPlayerIds.map((id) => `A:${id}`),
    ...sideBPlayerIds.map((id) => `B:${id}`),
  ]
    .sort()
    .join(",");
  const playersChanged = currentKey !== newKey;

  let updatedMatch;
  try {
    [updatedMatch] = await prisma.$transaction([
      prisma.padelMatch.update({
        where: { id: matchId },
        data: {
          matchType,
          round,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          ...(playersChanged
            ? { status: "SCHEDULED" as const, winnerSide: null, retired: false, completedAt: null }
            : {}),
        },
      }),
      prisma.padelMatchPlayer.deleteMany({ where: { matchId } }),
      prisma.padelMatchPlayer.createMany({
        data: [
          ...sideAPlayerIds.map((playerId) => ({ matchId, side: "A" as const, playerId })),
          ...sideBPlayerIds.map((playerId) => ({ matchId, side: "B" as const, playerId })),
        ],
      }),
      ...(playersChanged ? [prisma.padelMatchSet.deleteMany({ where: { matchId } })] : []),
    ]);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Матч не знайдено — можливо, його вже видалили" };
    }
    if (isForeignKeyError(error)) {
      return { error: "Гравець не знайдено — можливо, його вже видалили" };
    }
    if (isUniqueConstraintError(error)) {
      const target = uniqueConstraintTarget(error) ?? [];
      if (target.includes("round")) {
        return { error: `У цьому турнірі вже є матч з раундом «${round}»` };
      }
      return {
        error: "Дані матчу змінилися одночасно в іншому місці — оновіть сторінку і спробуйте ще раз",
      };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.match.update",
    entityType: "PadelMatch",
    entityId: matchId,
    summary: playersChanged ? "Оновлено матч (Падел, склад гравців змінено)" : "Оновлено матч (Падел)",
  }));

  revalidatePath(`/admin/padel/tournaments/${updatedMatch.tournamentId}`);
  revalidatePath(`/padel/tournaments/${updatedMatch.tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return {
    success: true,
    ...(playersChanged
      ? { notice: "Склад гравців змінився — рахунок матчу скинуто." }
      : {}),
  };
}

/** Padel twin of StaleScoreConflictError from matches.ts. */
class StaleScoreConflictError extends Error {}

export async function deletePadelMatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Матч не знайдено" };
  }
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  const existingMatch = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    select: { tournamentId: true },
  });
  if (!existingMatch) {
    return { error: "Матч не знайдено — можливо, його вже видалили" };
  }

  const hasAdvancements =
    (await prisma.padelMatchAdvancement.count({ where: { tournamentId: existingMatch.tournamentId } })) > 0;

  try {
    await prisma.$transaction(async (tx) => {
      if (hasAdvancements) {
        const snapshot = await buildPadelBracketSnapshot(tx, existingMatch.tournamentId);
        const snapshotForDeletion: TournamentBracketSnapshot = {
          ...snapshot,
          matches: snapshot.matches.map((m) =>
            m.id === matchId ? { ...m, status: "CANCELLED" as const } : m,
          ),
        };
        const propagation = computeAdvancementPropagation(snapshotForDeletion, matchId);

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

      await tx.padelMatch.delete({ where: { id: matchId } });
    });
  } catch (error) {
    if (error instanceof CascadeResetPendingError) {
      return {
        error: "Видалення скине рахунок матчів нижче по сітці — підтвердьте скид, щоб продовжити.",
        cascadeResets: error.resets,
      };
    }
    if (isRecordNotFoundError(error)) {
      return { error: "Матч не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.match.delete",
    entityType: "PadelMatch",
    entityId: matchId,
    summary: `Видалено матч (Падел) у турнірі ${existingMatch.tournamentId}`,
  }));

  revalidatePath(`/admin/padel/tournaments/${existingMatch.tournamentId}`);
  revalidatePath(`/padel/tournaments/${existingMatch.tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true };
}

export async function savePadelScoreAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("PADEL");

  let rawSets: unknown;
  try {
    rawSets = JSON.parse(String(formData.get("setsJson") ?? "[]"));
  } catch {
    return { error: "Некоректний рахунок" };
  }

  const parsed = scoreFormSchema.safeParse({
    matchId: formData.get("matchId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    retired: formData.get("retired") === "true",
    retiredWinnerSide: formData.get("retiredWinnerSide") || null,
    sets: rawSets,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректний рахунок",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  const winnerSide = parsed.data.retired
    ? parsed.data.retiredWinnerSide
    : determineMatchWinner(parsed.data.sets);
  if (!parsed.data.retired && parsed.data.sets.length > 0 && !winnerSide) {
    return { error: "Неможливо визначити переможця — рахунок сетів рівний" };
  }

  const existingMatch = await prisma.padelMatch.findUnique({
    where: { id: parsed.data.matchId },
    select: { completedAt: true, updatedAt: true, tournamentId: true },
  });
  if (!existingMatch) {
    return { error: "Матч не знайдено — можливо, його вже видалили" };
  }
  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
  if (
    Number.isNaN(expectedUpdatedAt.getTime()) ||
    expectedUpdatedAt.getTime() !== existingMatch.updatedAt.getTime()
  ) {
    return {
      error: "Матч змінили в іншому місці, поки форма була відкрита. Оновіть сторінку і спробуйте ще раз.",
    };
  }
  const completedAt = winnerSide ? (existingMatch.completedAt ?? new Date()) : null;

  const hasAdvancements =
    (await prisma.padelMatchAdvancement.count({ where: { tournamentId: existingMatch.tournamentId } })) > 0;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.padelMatchSet.deleteMany({ where: { matchId: parsed.data.matchId } });
      await tx.padelMatchSet.createMany({
        data: parsed.data.sets.map((set, index) => ({
          matchId: parsed.data.matchId,
          setNumber: index + 1,
          sideAGames: set.sideAGames,
          sideBGames: set.sideBGames,
          tiebreakSideAPoints: set.tiebreakSideAPoints ?? null,
          tiebreakSideBPoints: set.tiebreakSideBPoints ?? null,
        })),
      });
      const result = await tx.padelMatch.updateMany({
        where: { id: parsed.data.matchId, updatedAt: expectedUpdatedAt },
        data: {
          status: winnerSide ? "COMPLETED" : "SCHEDULED",
          winnerSide,
          retired: parsed.data.retired,
          completedAt,
        },
      });
      if (result.count === 0) {
        throw new StaleScoreConflictError();
      }

      if (!hasAdvancements) return;

      const snapshot = await buildPadelBracketSnapshot(tx, existingMatch.tournamentId);
      const propagation = computeAdvancementPropagation(snapshot, parsed.data.matchId);

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
          await tx.padelMatchPlayer.create({ data: { matchId: fill.matchId, side: fill.side, playerId: fill.playerId } });
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
    });
  } catch (error) {
    if (error instanceof CascadeResetPendingError) {
      return {
        error: "Цей результат скине рахунок матчів нижче по сітці — підтвердьте скид, щоб продовжити.",
        cascadeResets: error.resets,
      };
    }
    if (error instanceof StaleScoreConflictError) {
      return {
        error: "Матч змінили в іншому місці, поки форма була відкрита. Оновіть сторінку і спробуйте ще раз.",
      };
    }
    if (isRecordNotFoundError(error)) {
      return { error: "Матч не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "padel.match.score",
    entityType: "PadelMatch",
    entityId: parsed.data.matchId,
    summary: parsed.data.retired
      ? "Збережено рахунок матчу (Падел, завершено зняттям гравця)"
      : "Збережено рахунок матчу (Падел)",
  }));

  revalidatePath(`/admin/padel/tournaments/${existingMatch.tournamentId}`);
  revalidatePath(`/padel/tournaments/${existingMatch.tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true };
}
