"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { buildBracketSnapshot, CascadeResetPendingError } from "@/lib/actions/bracket-snapshot";
import type { CascadeReset } from "@/lib/actions/bracket-snapshot";
import { checkCompletedMatchesAcknowledged } from "@/lib/actions/match-randomize-shared";
import { logAudit } from "@/lib/audit";
import { computeAdvancementPropagation } from "@/lib/bracket-advancement";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { isForeignKeyError, isRecordNotFoundError, uniqueConstraintTarget } from "@/lib/prisma-errors";
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
export async function resetTournamentAction(
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

export async function addParticipantAction(
  tournamentId: string,
  playerIds: string[],
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  if (playerIds.length === 0) {
    return { error: "Оберіть хоча б одного гравця" };
  }

  try {
    await prisma.$transaction(
      playerIds.map((playerId) =>
        prisma.tournamentParticipant.upsert({
          where: { tournamentId_playerId: { tournamentId, playerId } },
          update: {},
          create: { tournamentId, playerId },
        }),
      ),
    );
  } catch (error) {
    // Tournament or one of the players was removed concurrently between the
    // form loading and this submit - same translated-error pattern as every
    // other tournament-scoped mutation in this file (e.g. createTournamentGroupAction).
    if (isForeignKeyError(error)) {
      return { error: "Турнір або гравець не знайдено — можливо, їх вже видалили" };
    }
    throw error;
  }

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
export async function withdrawParticipantAction(
  _prevState: WithdrawActionState,
  formData: FormData,
): Promise<WithdrawActionState> {
  const session = await requireAdmin();

  const tournamentId = formData.get("tournamentId");
  const playerId = formData.get("playerId");
  if (typeof tournamentId !== "string" || !tournamentId || typeof playerId !== "string" || !playerId) {
    return { error: "Турнір або гравця не знайдено" };
  }
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

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
          await tx.matchPlayer.deleteMany({ where: { matchId: fill.matchId, side: fill.side } });
          if (fill.playerId) {
            await tx.matchPlayer.create({
              data: { matchId: fill.matchId, side: fill.side, playerId: fill.playerId },
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
  // The built-in 1-6 (A-F) round-robin bucket only - custom groups (see
  // createTournamentGroupAction) live in their own many-to-many table now,
  // not in this field.
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

/**
 * Adds an extra, freely-named group alongside the built-in 1-6 (A-F)
 * round-robin range - e.g. "Плейофф" for participants the admin wants to
 * organize outside the randomizer's own groups. Deliberately a many-to-many
 * TournamentGroupMember, not TournamentParticipant.group: a player can be
 * in their built-in round-robin group *and* any number of these custom
 * groups at once (e.g. still shown under "Група A" while also in
 * "Плейофф") - group.number is still picked past every number already in
 * use (built-in or custom) purely so groupRoundLabel/resolveGroupLabel
 * never collide with a real 1-6 letter, not because membership is
 * exclusive anymore.
 */
export async function createTournamentGroupAction(
  tournamentId: string,
  name: string,
  playerIds: string[] = [],
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) return { error: "Вкажіть назву групи" };
  if (trimmed.length > 50) return { error: "Назва групи занадто довга (максимум 50 символів)" };

  const [participantMax, groupMax, participants] = await Promise.all([
    prisma.tournamentParticipant.aggregate({ where: { tournamentId }, _max: { group: true } }),
    prisma.tournamentGroup.aggregate({ where: { tournamentId }, _max: { number: true } }),
    prisma.tournamentParticipant.findMany({ where: { tournamentId }, select: { playerId: true } }),
  ]);
  const rosterIds = new Set(participants.map((p) => p.playerId));
  if (!playerIds.every((id) => rosterIds.has(id))) {
    return { error: "Гравець не зареєстрований у цьому турнірі" };
  }
  const nextNumber =
    1 + Math.max(MAX_TOURNAMENT_GROUPS, participantMax._max.group ?? 0, groupMax._max.number ?? 0);
  // Generated up front (rather than read back after tournamentGroup.create)
  // so it can be reused in the same array-form $transaction below - that
  // form runs every operation but can't feed one's result into the next,
  // unlike the interactive callback form (same pattern already used for
  // Match.id in randomize-singles.ts/randomize-doubles.ts's own
  // array-transactions).
  const groupId = randomUUID();

  try {
    await prisma.$transaction([
      prisma.tournamentGroup.create({
        data: { id: groupId, tournamentId, number: nextNumber, name: trimmed },
      }),
      ...(playerIds.length > 0
        ? [
            prisma.tournamentGroupMember.createMany({
              data: playerIds.map((playerId) => ({ tournamentGroupId: groupId, playerId })),
            }),
          ]
        : []),
    ]);
  } catch (error) {
    const target = uniqueConstraintTarget(error);
    if (target) {
      // Two different unique constraints can throw P2002 here: tournamentGroup's
      // own [tournamentId, number] (a concurrent "Додати групу" click picked the
      // same nextNumber - rare, advisory locking would be overkill, but
      // retryable) vs. tournamentGroupMember's [tournamentGroupId, playerId]
      // (playerIds contained a duplicate) - conflating them would misreport a
      // real duplicate-member bug as a transient number race.
      return {
        error: target.includes("number")
          ? "Групу з таким номером щойно створили в іншому місці — спробуйте ще раз"
          : "Один із гравців обраний двічі",
      };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "tournament.group.create",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Додано групу «${trimmed}»${playerIds.length > 0 ? ` (${playerIds.length} гравців)` : ""}`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return {};
}

/**
 * Renames a custom group (see createTournamentGroupAction) and/or replaces
 * its member list wholesale - same delete-then-recreate approach as
 * saveScoreAction's MatchSet rewrite, simpler than diffing old vs. new
 * membership for a list this small. `number` is never touched (only set
 * once, at creation) - editing can't collide with the
 * [tournamentId, number] uniqueness createTournamentGroupAction guards.
 */
export async function updateTournamentGroupAction(
  tournamentId: string,
  groupId: string,
  name: string,
  playerIds: string[] = [],
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) return { error: "Вкажіть назву групи" };
  if (trimmed.length > 50) return { error: "Назва групи занадто довга (максимум 50 символів)" };

  const [group, participants] = await Promise.all([
    prisma.tournamentGroup.findUnique({ where: { id: groupId }, select: { tournamentId: true } }),
    prisma.tournamentParticipant.findMany({ where: { tournamentId }, select: { playerId: true } }),
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
      prisma.tournamentGroup.update({ where: { id: groupId }, data: { name: trimmed } }),
      prisma.tournamentGroupMember.deleteMany({ where: { tournamentGroupId: groupId } }),
      ...(playerIds.length > 0
        ? [
            prisma.tournamentGroupMember.createMany({
              data: playerIds.map((playerId) => ({ tournamentGroupId: groupId, playerId })),
            }),
          ]
        : []),
    ]);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Групу не знайдено — можливо, її вже видалили" };
    }
    // A duplicate id in playerIds is the only way tournamentGroupMember's own
    // [tournamentGroupId, playerId] unique constraint can fire here - the
    // membership was just wiped by the deleteMany above, so there's no
    // pre-existing row left to collide with.
    if (uniqueConstraintTarget(error)) {
      return { error: "Один із гравців обраний двічі" };
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "tournament.group.update",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Оновлено групу «${trimmed}»${playerIds.length > 0 ? ` (${playerIds.length} гравців)` : ""}`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return {};
}

/**
 * Removes a custom group (see createTournamentGroupAction) entirely - its
 * TournamentGroupMember rows cascade-delete with it. Built-in 1-6 groups
 * aren't deletable through this action at all (they're not TournamentGroup
 * rows - see the schema comment).
 */
export async function deleteTournamentGroupAction(
  tournamentId: string,
  groupId: string,
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  const group = await prisma.tournamentGroup.findUnique({
    where: { id: groupId },
    select: { tournamentId: true, name: true },
  });
  if (!group || group.tournamentId !== tournamentId) {
    return { error: "Групу не знайдено — можливо, її вже видалили" };
  }

  await prisma.tournamentGroup.delete({ where: { id: groupId } });

  after(() => logAudit(session.user, {
    action: "tournament.group.delete",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Видалено групу «${group.name}»`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return {};
}
