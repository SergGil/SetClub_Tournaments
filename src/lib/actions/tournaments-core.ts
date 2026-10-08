import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { buildBracketSnapshot, CascadeResetPendingError } from "@/lib/actions/bracket-snapshot";
import type { CascadeReset } from "@/lib/actions/bracket-snapshot";
import { checkCompletedMatchesAcknowledged } from "@/lib/actions/match-randomize-shared";
import { logAudit } from "@/lib/audit";
import { computeAdvancementPropagation, sideTeamLabel } from "@/lib/bracket-advancement";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import { deleteObject } from "@/lib/r2";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";
import type { TournamentFormInput } from "@/lib/validation/tournament";

function cleanUpOldPhoto(key: string) {
  deleteObject(key).catch((error) => console.error("Failed to delete R2 object for tournament photo", key, error));
}

export type ActionState = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

/** Shared by createTournamentAction (web form) and POST /api/v1/tournaments (mobile) - see docs/MOBILE_API.md. */
export async function createTournamentCore(session: Awaited<ReturnType<typeof requireDomainAdmin>>, data: TournamentFormInput) {
  const tournament = await prisma.tournament.create({
    data: {
      name: data.name,
      description: data.description,
      format: data.format,
      status: data.status,
      surface: data.surface,
      isWomensOnly: data.isWomensOnly,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
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
  return tournament;
}

/** Shared by updateTournamentAction (web form) and PATCH /api/v1/tournaments/[id] (mobile) - see docs/MOBILE_API.md. */
export async function updateTournamentCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  data: TournamentFormInput,
): Promise<ActionState> {
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
  if (current.format !== data.format && current._count.matches > 0) {
    const message = "Не можна змінити формат турніру, коли в ньому вже є матчі — спершу видаліть їх.";
    return { error: message, fieldErrors: { format: message } };
  }

  try {
    await prisma.tournament.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        format: data.format,
        status: data.status,
        surface: data.surface,
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
    action: "tournament.update",
    entityType: "Tournament",
    entityId: id,
    summary: `Оновлено турнір "${data.name}"`,
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

type DeleteTournamentResult = { error: string } | { name: string };

/** Shared by deleteTournamentAction (web form) and DELETE /api/v1/tournaments/[id] (mobile) - see docs/MOBILE_API.md. */
export async function deleteTournamentCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  acknowledgedCompletedLoss: boolean,
): Promise<DeleteTournamentResult> {
  const completedError = await checkCompletedMatchesAcknowledged(id, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  // Read every photo's R2 key before deleting - the delete below cascades
  // every Photo row away at the DB level (onDelete: Cascade), which would
  // otherwise leave their R2 objects orphaned with no row left to point at
  // them (same pattern as deleteMenuSectionAction's item-photo cleanup).
  const existing = await prisma.tournament.findUnique({
    where: { id },
    select: { photos: { select: { key: true } } },
  });

  let deleted;
  try {
    deleted = await prisma.tournament.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Турнір не знайдено — можливо, його вже видалили" };
    }
    throw error;
  }

  for (const { key } of existing?.photos ?? []) cleanUpOldPhoto(key);

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
  return { name: deleted.name };
}

/**
 * Wipes a tournament back to just its roster: every match (and, via cascade,
 * their MatchPlayer/MatchSet/MatchAdvancement rows) plus every group
 * assignment - both the built-in 1-6 `TournamentParticipant.group` bucket
 * and any custom "Додаткові групи" (TournamentGroup, cascading its
 * TournamentGroupMember rows). Participants themselves, and their `seed`
 * flag, are left untouched - "сіяність" isn't a "розподіл по групам", it's
 * a separate per-player attribute an admin sets before drawing groups again.
 * Same completed-match confirmation gate as deleteTournamentAction/the
 * randomizer, since this is just as destructive to recorded scores.
 */
/** Shared by resetTournamentAction (web form) and POST /api/v1/tournaments/[id]/reset (mobile) - see docs/MOBILE_API.md. */
export async function resetTournamentCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  id: string,
  acknowledgedCompletedLoss: boolean,
): Promise<ActionState> {
  const completedError = await checkCompletedMatchesAcknowledged(id, acknowledgedCompletedLoss);
  if (completedError) return { error: completedError };

  const tournament = await prisma.tournament.findUnique({ where: { id }, select: { name: true } });
  if (!tournament) {
    return { error: "Турнір не знайдено — можливо, його вже видалили" };
  }

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { tournamentId: id } }),
    prisma.tournamentGroup.deleteMany({ where: { tournamentId: id } }),
    prisma.tournamentParticipant.updateMany({ where: { tournamentId: id }, data: { group: null } }),
  ]);

  after(() => logAudit(session.user, {
    action: "tournament.reset",
    entityType: "Tournament",
    entityId: id,
    summary: `Обнулено турнір "${tournament.name}" — видалено матчі й розподіл по групах`,
  }));

  revalidatePath(`/admin/tournaments/${id}`);
  revalidatePath(`/tournaments/${id}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}

export type WithdrawActionState = {
  error?: string;
  success?: boolean;
  /** Set only when closing a SCHEDULED match as a walkover would cascade-reset an already-COMPLETED match further down the bracket and the caller hasn't confirmed via acknowledgedCascadeReset yet - see bracket-advancement.ts. */
  cascadeResets?: CascadeReset[];
};

/**
 * Thrown from inside withdrawParticipantAction's transaction when the
 * per-tournament advisory lock (see below) reveals the participant was
 * already withdrawn by a concurrent submit that ran first - a plain
 * early-return wouldn't undo the participant update that already ran in the
 * same transaction. Same pattern as StaleScoreConflictError in matches.ts.
 */
class AlreadyWithdrawnError extends Error {}

/**
 * Bulk-withdraws a participant from a SINGLES/MIXED tournament (see
 * docs/WITHDRAWAL.md): closes every still-SCHEDULED match of theirs as a
 * walkover (technical loss) for the opponent, without touching already-
 * COMPLETED matches. The participant itself is never removed from the
 * roster - only `withdrawnAt` is stamped, so the roster/standings keep
 * showing them (with their real, pre-withdrawal record intact).
 *
 * DOUBLES isn't supported yet - withdrawing one half of a pair is a
 * meaningfully different problem (partner reassignment) that hasn't been
 * asked for.
 */
/** Shared by withdrawParticipantAction (web form) and POST /api/v1/tournaments/[id]/participants/[playerId]/withdraw (mobile) - see docs/MOBILE_API.md. */
export async function withdrawParticipantCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  tournamentId: string,
  playerId: string,
  acknowledgedCascadeReset: boolean,
): Promise<WithdrawActionState> {
  const [tournament, participant] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId }, select: { format: true } }),
    prisma.tournamentParticipant.findUnique({
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
      // Same per-tournament advisory lock the randomizer commits use
      // (randomize-doubles.ts etc.) - a double-click/double-submit of this
      // action would otherwise let two withdrawals for the same player
      // interleave their read-then-write-then-cascade sequence under READ
      // COMMITTED.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 0)`;

      // Conditional on withdrawnAt: null (not a plain update) so that once
      // the lock above serializes two concurrent submits, the second one
      // detects the race here and bails out cleanly instead of re-stamping
      // withdrawnAt and re-running the walkover cascade a second time.
      const { count } = await tx.tournamentParticipant.updateMany({
        where: { tournamentId, playerId, withdrawnAt: null },
        data: { withdrawnAt: new Date() },
      });
      if (count === 0) throw new AlreadyWithdrawnError();

      const scheduledMatches = await tx.match.findMany({
        where: { tournamentId, status: "SCHEDULED", players: { some: { playerId } } },
        select: { id: true, players: { select: { side: true, playerId: true } } },
      });

      const closedMatchIds: string[] = [];
      for (const match of scheduledMatches) {
        const opponent = match.players.find((p) => p.playerId !== playerId);
        if (match.players.length === 2 && opponent) {
          await tx.match.update({
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
          // Opponent slot not filled yet (pending GROUPS_12_PLAYOFF
          // advancement) - nobody to award the walkover to, just vacate the
          // withdrawn player's own slot. groupRankPlayer excludes them from
          // now on, so a later propagation call naturally fills it with the
          // correct alternate instead.
          await tx.matchPlayer.deleteMany({ where: { matchId: match.id, playerId } });
        }
      }
      closedMatchCount = closedMatchIds.length;

      const hasAdvancements = (await tx.matchAdvancement.count({ where: { tournamentId } })) > 0;
      if (!hasAdvancements || closedMatchIds.length === 0) return;

      // One propagation pass per closed match, same as saveScoreAction does
      // for the single match it just saved - each pass re-reads the bracket
      // so it sees the previous pass's fills/resets already applied. A
      // withdrawal that cascades into resets from more than one of these
      // matches would surface them one confirmation at a time rather than
      // all at once - an acceptable rough edge for a scenario this rare in
      // a small club tournament, not worth a full two-pass "compute every
      // eventual reset before applying any" rewrite.
      for (const matchId of closedMatchIds) {
        const snapshot = await buildBracketSnapshot(tx, tournamentId);
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
          await tx.matchPlayer.deleteMany({ where: { matchId: fill.matchId, side: fill.side } });
          if (fill.playerIds.length > 0) {
            await tx.matchPlayer.createMany({
              data: fill.playerIds.map((playerId) => ({ matchId: fill.matchId, side: fill.side, playerId })),
            });
          }
        }
        const resetMatchIds = [...new Set(propagation.resets.map((r) => r.matchId))];
        if (resetMatchIds.length > 0) {
          await tx.matchSet.deleteMany({ where: { matchId: { in: resetMatchIds } } });
          await tx.match.updateMany({
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
    action: "tournament.participant.withdraw",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Знято з турніру гравця ${participant.player.name} — технічна поразка у ${closedMatchCount} матч(ах)`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}