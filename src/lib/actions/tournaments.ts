"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { tournamentFormSchema } from "@/lib/validation/tournament";

export type ActionState = { error?: string; success?: boolean };

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
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  const tournament = await prisma.tournament.create({
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

  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  redirect(`/admin/tournaments/${tournament.id}`);
}

export async function updateTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Турнір не знайдено" };
  }

  const parsed = tournamentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    format: formData.get("format"),
    status: formData.get("status"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані" };
  }

  await prisma.tournament.update({
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

  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${id}`);
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${id}`);
  return { success: true };
}

export async function deleteTournamentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Турнір не знайдено" };
  }

  await prisma.tournament.delete({ where: { id } });
  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  redirect("/admin/tournaments");
}

export async function addParticipantAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const tournamentId = formData.get("tournamentId");
  const playerIds = formData.getAll("playerId").filter((v): v is string => typeof v === "string");
  if (typeof tournamentId !== "string" || playerIds.length === 0) {
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

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function removeParticipantAction(tournamentId: string, playerId: string) {
  await requireAdmin();
  await prisma.tournamentParticipant.deleteMany({ where: { tournamentId, playerId } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
}
