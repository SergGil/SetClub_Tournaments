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

/** Padel twin of createTeamAction - see its doc comment for the full rationale. */
export async function createPadelTeamAction(
  tournamentId: string,
  name: string,
  memberPlayerIds: string[],
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL");

  const validationError = validateTeamInput(name, memberPlayerIds);
  if (validationError) return { error: validationError };
  const trimmed = name.trim();

  const [tournament, participants] = await Promise.all([
    prisma.padelTournament.findUnique({ where: { id: tournamentId }, select: { format: true } }),
    prisma.padelTournamentParticipant.findMany({
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

  const teamId = randomUUID();
  try {
    await prisma.$transaction([
      prisma.padelTournamentTeam.create({ data: { id: teamId, tournamentId, name: trimmed } }),
      prisma.padelTournamentTeamMember.createMany({
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
      action: "padel.tournament.team.create",
      entityType: "PadelTournament",
      entityId: tournamentId,
      summary: `Створено команду (Падел) «${trimmed}» (${memberPlayerIds.length} гравців)`,
    }),
  );

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  return {};
}

/** Padel twin of updateTeamAction. */
export async function updatePadelTeamAction(
  tournamentId: string,
  teamId: string,
  name: string,
  memberPlayerIds: string[],
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL");

  const validationError = validateTeamInput(name, memberPlayerIds);
  if (validationError) return { error: validationError };
  const trimmed = name.trim();

  const [team, participants] = await Promise.all([
    prisma.padelTournamentTeam.findUnique({ where: { id: teamId }, select: { tournamentId: true } }),
    prisma.padelTournamentParticipant.findMany({
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
      prisma.padelTournamentTeam.update({ where: { id: teamId }, data: { name: trimmed } }),
      prisma.padelTournamentTeamMember.deleteMany({ where: { tournamentTeamId: teamId } }),
      prisma.padelTournamentTeamMember.createMany({
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
      action: "padel.tournament.team.update",
      entityType: "PadelTournament",
      entityId: tournamentId,
      summary: `Оновлено команду (Падел) «${trimmed}» (${memberPlayerIds.length} гравців)`,
    }),
  );

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  return {};
}

/** Padel twin of deleteTeamAction - blocked (via FK on PadelTournamentTie.teamAId/teamBId) while the team is still part of a tie. */
export async function deletePadelTeamAction(
  tournamentId: string,
  teamId: string,
): Promise<{ error?: string }> {
  const session = await requireDomainAdmin("PADEL");

  const team = await prisma.padelTournamentTeam.findUnique({
    where: { id: teamId },
    select: { tournamentId: true, name: true },
  });
  if (!team || team.tournamentId !== tournamentId) {
    return { error: "Команду не знайдено — можливо, її вже видалили" };
  }

  try {
    await prisma.padelTournamentTeam.delete({ where: { id: teamId } });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return { error: "Команда бере участь у зустрічі — спершу видаліть зустріч" };
    }
    throw error;
  }

  after(() =>
    logAudit(session.user, {
      action: "padel.tournament.team.delete",
      entityType: "PadelTournament",
      entityId: tournamentId,
      summary: `Видалено команду (Падел) «${team.name}»`,
    }),
  );

  revalidatePath(`/admin/padel/tournaments/${tournamentId}`);
  revalidatePath(`/padel/tournaments/${tournamentId}`);
  return {};
}
