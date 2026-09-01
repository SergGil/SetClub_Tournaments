"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { isForeignKeyError, isRecordNotFoundError, uniqueConstraintTarget } from "@/lib/prisma-errors";

const MIN_TEAM_SIZE = 2;
const MAX_TEAM_SIZE = 4;

function validateTeamInput(name: string, memberPlayerIds: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Вкажіть назву команди";
  if (trimmed.length > 60) return "Назва команди занадто довга (максимум 60 символів)";
  if (memberPlayerIds.length < MIN_TEAM_SIZE || memberPlayerIds.length > MAX_TEAM_SIZE) {
    return `У команді має бути від ${MIN_TEAM_SIZE} до ${MAX_TEAM_SIZE} гравців`;
  }
  if (new Set(memberPlayerIds).size !== memberPlayerIds.length) {
    return "Гравець обраний двічі";
  }
  return null;
}

/**
 * Opt-in roster unit for MIXED-format team/tie play (see createTieAction) -
 * a fixed 2-4 player group an admin forms deliberately. Deliberately plain
 * args + manual validation rather than a FormData/Zod action, mirroring
 * createTournamentGroupAction's style (the closest existing precedent for
 * "small admin CRUD dialog with a name + player-id list"), not
 * matchFormSchema's FormData/useActionState style, which is reserved for the
 * player-slot-heavy match/rubber forms (see createRubberAction).
 */
export async function createTeamAction(
  tournamentId: string,
  name: string,
  memberPlayerIds: string[],
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

  const validationError = validateTeamInput(name, memberPlayerIds);
  if (validationError) return { error: validationError };
  const trimmed = name.trim();

  const [tournament, participants] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId }, select: { format: true } }),
    prisma.tournamentParticipant.findMany({
      where: { tournamentId, withdrawnAt: null },
      select: { playerId: true },
    }),
  ]);
  if (!tournament) return { error: "Турнір не знайдено" };
  if (tournament.format !== "MIXED") return { error: "Команди доступні лише для змішаних турнірів" };
  const rosterIds = new Set(participants.map((p) => p.playerId));
  if (!memberPlayerIds.every((id) => rosterIds.has(id))) {
    return { error: "Гравець не зареєстрований у цьому турнірі" };
  }

  // Generated up front so it can be reused in the same array-form
  // $transaction below - same pattern createTournamentGroupAction uses for
  // TournamentGroup.id.
  const teamId = randomUUID();
  try {
    await prisma.$transaction([
      prisma.tournamentTeam.create({ data: { id: teamId, tournamentId, name: trimmed } }),
      prisma.tournamentTeamMember.createMany({
        data: memberPlayerIds.map((playerId) => ({ tournamentTeamId: teamId, tournamentId, playerId })),
      }),
    ]);
  } catch (error) {
    if (uniqueConstraintTarget(error)) {
      return { error: "Гравець уже в іншій команді цього турніру" };
    }
    throw error;
  }

  after(() =>
    logAudit(session.user, {
      action: "tournament.team.create",
      entityType: "Tournament",
      entityId: tournamentId,
      summary: `Створено команду «${trimmed}» (${memberPlayerIds.length} гравців)`,
    }),
  );

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return {};
}

/** Renames a team and/or replaces its member list wholesale - delete-then-recreate, same approach as updateTournamentGroupAction. */
export async function updateTeamAction(
  tournamentId: string,
  teamId: string,
  name: string,
  memberPlayerIds: string[],
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

  const validationError = validateTeamInput(name, memberPlayerIds);
  if (validationError) return { error: validationError };
  const trimmed = name.trim();

  const [team, participants] = await Promise.all([
    prisma.tournamentTeam.findUnique({ where: { id: teamId }, select: { tournamentId: true } }),
    prisma.tournamentParticipant.findMany({
      where: { tournamentId, withdrawnAt: null },
      select: { playerId: true },
    }),
  ]);
  if (!team || team.tournamentId !== tournamentId) {
    return { error: "Команду не знайдено — можливо, її вже видалили" };
  }
  const rosterIds = new Set(participants.map((p) => p.playerId));
  if (!memberPlayerIds.every((id) => rosterIds.has(id))) {
    return { error: "Гравець не зареєстрований у цьому турнірі" };
  }

  try {
    await prisma.$transaction([
      prisma.tournamentTeam.update({ where: { id: teamId }, data: { name: trimmed } }),
      prisma.tournamentTeamMember.deleteMany({ where: { tournamentTeamId: teamId } }),
      prisma.tournamentTeamMember.createMany({
        data: memberPlayerIds.map((playerId) => ({ tournamentTeamId: teamId, tournamentId, playerId })),
      }),
    ]);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { error: "Команду не знайдено — можливо, її вже видалили" };
    }
    if (uniqueConstraintTarget(error)) {
      return { error: "Гравець уже в іншій команді цього турніру" };
    }
    throw error;
  }

  after(() =>
    logAudit(session.user, {
      action: "tournament.team.update",
      entityType: "Tournament",
      entityId: tournamentId,
      summary: `Оновлено команду «${trimmed}» (${memberPlayerIds.length} гравців)`,
    }),
  );

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return {};
}

/** Blocked (via the FK constraint on TournamentTie.teamAId/teamBId) while the team is still part of a tie - delete the tie first. */
export async function deleteTeamAction(
  tournamentId: string,
  teamId: string,
  request?: Request,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("TENNIS", request);

  const team = await prisma.tournamentTeam.findUnique({
    where: { id: teamId },
    select: { tournamentId: true, name: true },
  });
  if (!team || team.tournamentId !== tournamentId) {
    return { error: "Команду не знайдено — можливо, її вже видалили" };
  }

  try {
    await prisma.tournamentTeam.delete({ where: { id: teamId } });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return { error: "Команда бере участь у зустрічі — спершу видаліть зустріч" };
    }
    throw error;
  }

  after(() =>
    logAudit(session.user, {
      action: "tournament.team.delete",
      entityType: "Tournament",
      entityId: tournamentId,
      summary: `Видалено команду «${team.name}»`,
    }),
  );

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return {};
}
