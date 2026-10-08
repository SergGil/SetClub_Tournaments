"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { isForeignKeyError, isRecordNotFoundError, uniqueConstraintTarget } from "@/lib/prisma-errors";
import { buildTeamRoundRobin, MAX_TOURNAMENT_GROUPS } from "@/lib/randomize-pairs";
import type { Team } from "@/lib/randomize-pairs";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";
import { tournamentFormSchema } from "@/lib/validation/tournament";
import { fieldErrorsFromZod } from "@/lib/zod-errors";
import {
  createTournamentCore,
  updateTournamentCore,
  deleteTournamentCore,
  resetTournamentCore,
  withdrawParticipantCore,
  type ActionState,
  type WithdrawActionState,
} from "@/lib/actions/tournaments-core";

export type { WithdrawActionState, ActionState } from "@/lib/actions/tournaments-core";

export async function createTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const parsed = tournamentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    format: formData.get("format"),
    status: formData.get("status"),
    surface: formData.get("surface"),
    isWomensOnly: formData.get("isWomensOnly"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const tournament = await createTournamentCore(session, parsed.data);
  redirect(`/admin/tournaments/${tournament.id}`);
}

export async function updateTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

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
    isWomensOnly: formData.get("isWomensOnly"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некоректні дані",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  return updateTournamentCore(session, id, parsed.data);
}

export async function deleteTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Турнір не знайдено" };
  }

  const acknowledgedCompletedLoss = formData.get("acknowledgedCompletedLoss") === "true";
  const result = await deleteTournamentCore(session, id, acknowledgedCompletedLoss);
  if ("error" in result) return { error: result.error };
  redirect("/admin/tournaments");
}

export async function resetTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Турнір не знайдено" };
  }

  const acknowledgedCompletedLoss = formData.get("acknowledgedCompletedLoss") === "true";
  return resetTournamentCore(session, id, acknowledgedCompletedLoss);
}

export async function addParticipantAction(
  tournamentId: string,
  playerIds: string[],
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

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
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

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

export async function withdrawParticipantAction(
  _prevState: WithdrawActionState,
  formData: FormData,
): Promise<WithdrawActionState> {
  const session = await requireDomainAdmin("TENNIS");

  const tournamentId = formData.get("tournamentId");
  const playerId = formData.get("playerId");
  if (typeof tournamentId !== "string" || !tournamentId || typeof playerId !== "string" || !playerId) {
    return { error: "Турнір або гравця не знайдено" };
  }
  const acknowledgedCascadeReset = formData.get("acknowledgedCascadeReset") === "true";

  return withdrawParticipantCore(session, tournamentId, playerId, acknowledgedCascadeReset);
}

export async function toggleParticipantSeedAction(
  tournamentId: string,
  playerId: string,
  seeded: boolean,
  request?: Request,
) {
  const session = await requireDomainAdmin("TENNIS", request);
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
  request?: Request,
) {
  const session = await requireDomainAdmin("TENNIS", request);
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
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

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
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

  const trimmed = name.trim();
  if (!trimmed) return { error: "Вкажіть назву групи" };
  if (trimmed.length > 50) return { error: "Назва групи занадто довга (максимум 50 символів)" };

  const [group, participants] = await Promise.all([
    prisma.tournamentGroup.findUnique({ where: { id: groupId }, select: { tournamentId: true, name: true } }),
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
      // Existing matches (including completed ones) are tagged by
      // round === the group's OLD name (see tournament-standings.ts's
      // customGroupNameSet scoping) - without this, a rename would silently
      // drop them out of the group's own standings.
      ...(group.name !== trimmed
        ? [prisma.match.updateMany({ where: { tournamentId, round: group.name }, data: { round: trimmed } })]
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

export type GroupPairsCommitState = { error?: string; success?: boolean; matchCount?: number };

/**
 * Shape/self-pair/roster-membership/duplicate-player validation for a set of
 * pairs meant to become an entire custom group's doubles roster - twin of
 * validateFixedPairs (randomize-doubles.ts), but every pair here is explicit
 * up front (no random leftover to fill the group out).
 */
function validateGroupPairs(pairs: unknown, rosterIds: Set<string>): string | null {
  if (!Array.isArray(pairs)) return "Некоректні пари";
  const seen = new Set<string>();
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2) return "Некоректна пара";
    if (pair[0] === pair[1]) return "Пара не може складатися з одного й того ж гравця";
    for (const playerId of pair) {
      if (typeof playerId !== "string" || !rosterIds.has(playerId)) {
        return "Гравець із пари не належить турніру";
      }
      if (seen.has(playerId)) return "Гравець не може бути у двох парах одночасно";
      seen.add(playerId);
    }
  }
  return null;
}

/**
 * Doubles-only alternative to createTournamentGroupAction: instead of adding
 * loose individual players to a custom group, the admin specifies its exact
 * teams up front - the group's membership is derived from those pairs, and
 * the full round robin between them is generated immediately. No randomizer
 * involved, since the pairing here is already fully decided (e.g. the known
 * group-stage winners advancing into a "Гра за 1-3 місце" playoff).
 */
export async function createTournamentGroupWithPairsAction(
  tournamentId: string,
  name: string,
  pairs: [string, string][],
  request?: Request,
): Promise<GroupPairsCommitState> {
  const session = await requireDomainAdmin("TENNIS", request);

  const trimmed = name.trim();
  if (!trimmed) return { error: "Вкажіть назву групи" };
  if (trimmed.length > 50) return { error: "Назва групи занадто довга (максимум 50 символів)" };

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true, startDate: true },
  });
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "DOUBLES") {
    return { error: "Пари можна вказати лише для парного турніру" };
  }

  const [participantMax, groupMax, participants] = await Promise.all([
    prisma.tournamentParticipant.aggregate({ where: { tournamentId }, _max: { group: true } }),
    prisma.tournamentGroup.aggregate({ where: { tournamentId }, _max: { number: true } }),
    prisma.tournamentParticipant.findMany({ where: { tournamentId }, select: { playerId: true } }),
  ]);
  const rosterIds = new Set(participants.map((p) => p.playerId));
  const pairsError = validateGroupPairs(pairs, rosterIds);
  if (pairsError) return { error: pairsError };

  const nextNumber =
    1 + Math.max(MAX_TOURNAMENT_GROUPS, participantMax._max.group ?? 0, groupMax._max.number ?? 0);
  const groupId = randomUUID();
  const playerIds = pairs.flat();
  const teams: Team[] = pairs.map((teamPlayerIds) => ({ playerIds: teamPlayerIds }));
  const matchups = buildTeamRoundRobin(teams);
  const rows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));

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
      ...(rows.length > 0
        ? [
            prisma.match.createMany({
              data: rows.map(({ id }) => ({
                id,
                tournamentId,
                matchType: "DOUBLES",
                scheduledDate: tournament.startDate,
                round: trimmed,
              })),
            }),
            prisma.matchPlayer.createMany({
              data: rows.flatMap(({ id, matchup }) => [
                ...matchup.sideA.playerIds.map((playerId) => ({ matchId: id, side: "A" as const, playerId })),
                ...matchup.sideB.playerIds.map((playerId) => ({ matchId: id, side: "B" as const, playerId })),
              ]),
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
    action: "tournament.group.create",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Створено групу «${trimmed}» з ${pairs.length} парами (${matchups.length} матч(ів))`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true, matchCount: matchups.length };
}

/**
 * Doubles-only alternative to updateTournamentGroupAction: replaces the
 * group's pairs wholesale (same delete-then-recreate approach as
 * updateTournamentGroupAction's own member list) and regenerates its round
 * robin to match - only that group's own matches (round === the group's
 * current name) are touched, never the rest of the tournament's. Requires
 * confirmation (`acknowledgedCompletedLoss`) when any of those matches are
 * already COMPLETED with a recorded score, the same guard as the doubles
 * randomizer's own re-run (see checkCompletedMatchesAcknowledged) but scoped
 * to this one group's matches instead of the whole tournament's.
 */
export async function updateTournamentGroupPairsAction(
  tournamentId: string,
  groupId: string,
  name: string,
  pairs: [string, string][],
  acknowledgedCompletedLoss: boolean,
  request?: Request,
): Promise<GroupPairsCommitState> {
  const session = await requireDomainAdmin("TENNIS", request);

  const trimmed = name.trim();
  if (!trimmed) return { error: "Вкажіть назву групи" };
  if (trimmed.length > 50) return { error: "Назва групи занадто довга (максимум 50 символів)" };

  const [tournament, group, participants] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId }, select: { format: true, startDate: true } }),
    prisma.tournamentGroup.findUnique({ where: { id: groupId }, select: { tournamentId: true, name: true } }),
    prisma.tournamentParticipant.findMany({ where: { tournamentId }, select: { playerId: true } }),
  ]);
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "DOUBLES") {
    return { error: "Пари можна вказати лише для парного турніру" };
  }
  if (!group || group.tournamentId !== tournamentId) {
    return { error: "Групу не знайдено — можливо, її вже видалили" };
  }

  const rosterIds = new Set(participants.map((p) => p.playerId));
  const pairsError = validateGroupPairs(pairs, rosterIds);
  if (pairsError) return { error: pairsError };

  // A pure rename (same exact teams, only the label changes) never needs to
  // touch the round robin at all - detect it by comparing the submitted
  // pairs against the teams implied by the group's own existing matches
  // (same derivation the admin page uses to pre-fill this dialog). When they
  // match, just rename the group and carry its matches - completed ones
  // included - over to the new round name, with no confirmation gate.
  const existingMatches = await prisma.match.findMany({
    where: { tournamentId, round: group.name, matchType: "DOUBLES" },
    select: { players: { select: { side: true, playerId: true } } },
  });
  const teamKey = (playerIds: string[]) => [...playerIds].sort().join("+");
  const currentPairKeys = new Set(
    existingMatches.flatMap((m) =>
      (["A", "B"] as const)
        .map((side) => teamKey(m.players.filter((p) => p.side === side).map((p) => p.playerId)))
        .filter((key) => key.includes("+")),
    ),
  );
  const submittedPairKeys = new Set(pairs.map(teamKey));
  const pairsUnchanged =
    currentPairKeys.size === submittedPairKeys.size && [...currentPairKeys].every((k) => submittedPairKeys.has(k));

  if (pairsUnchanged) {
    try {
      await prisma.$transaction([
        prisma.tournamentGroup.update({ where: { id: groupId }, data: { name: trimmed } }),
        ...(group.name !== trimmed
          ? [prisma.match.updateMany({ where: { tournamentId, round: group.name }, data: { round: trimmed } })]
          : []),
      ]);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return { error: "Групу не знайдено — можливо, її вже видалили" };
      }
      throw error;
    }

    after(() => logAudit(session.user, {
      action: "tournament.group.update",
      entityType: "Tournament",
      entityId: tournamentId,
      summary: `Перейменовано групу «${group.name}» на «${trimmed}»`,
    }));

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournamentId}`);
    return { success: true, matchCount: existingMatches.length };
  }

  const completedCount = await prisma.match.count({
    where: { tournamentId, round: group.name, status: "COMPLETED" },
  });
  if (completedCount > 0 && !acknowledgedCompletedLoss) {
    return {
      error: `У групі є ${completedCount} завершених матчів із рахунком — підтвердьте видалення в діалозі`,
    };
  }

  const playerIds = pairs.flat();
  const teams: Team[] = pairs.map((teamPlayerIds) => ({ playerIds: teamPlayerIds }));
  const matchups = buildTeamRoundRobin(teams);
  const rows = matchups.map((matchup) => ({ id: randomUUID(), matchup }));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}), 0)`;
      await tx.tournamentGroup.update({ where: { id: groupId }, data: { name: trimmed } });
      await tx.tournamentGroupMember.deleteMany({ where: { tournamentGroupId: groupId } });
      if (playerIds.length > 0) {
        await tx.tournamentGroupMember.createMany({
          data: playerIds.map((playerId) => ({ tournamentGroupId: groupId, playerId })),
        });
      }
      await tx.match.deleteMany({ where: { tournamentId, round: group.name } });
      if (rows.length > 0) {
        await tx.match.createMany({
          data: rows.map(({ id }) => ({
            id,
            tournamentId,
            matchType: "DOUBLES",
            scheduledDate: tournament.startDate,
            round: trimmed,
          })),
        });
        await tx.matchPlayer.createMany({
          data: rows.flatMap(({ id, matchup }) => [
            ...matchup.sideA.playerIds.map((playerId) => ({ matchId: id, side: "A" as const, playerId })),
            ...matchup.sideB.playerIds.map((playerId) => ({ matchId: id, side: "B" as const, playerId })),
          ]),
        });
      }
    });
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
    action: "tournament.group.update",
    entityType: "Tournament",
    entityId: tournamentId,
    summary: `Оновлено групу «${trimmed}»: ${pairs.length} пар, ${matchups.length} матч(ів)`,
  }));

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true, matchCount: matchups.length };
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
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

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
