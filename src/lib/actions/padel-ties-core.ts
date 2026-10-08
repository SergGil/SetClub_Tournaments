import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import type { ActionState } from "@/lib/actions/padel-matches";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";
import { requireDomainAdmin } from "@/lib/permissions";
import { isForeignKeyError } from "@/lib/prisma-errors";
import { schedulePadelRatingSnapshotRefresh } from "@/lib/rating/padel-snapshot";
// Sport-agnostic (no Prisma coupling) - reused as-is, same as padel-matches.ts.
import type { RubberFormInput } from "@/lib/validation/rubber";

/** Padel twin of createRubberAction - creates one rubber (a normal PadelMatch, tagged with tieId) scoped to the tie's own two teams. */
/** Padel twin of createRubberCore. */
export async function createPadelRubberCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  data: RubberFormInput,
): Promise<ActionState> {
  const { tieId, matchType, scheduledDate, sideAPlayerIds, sideBPlayerIds } = data;

  const tie = await prisma.padelTournamentTie.findUnique({
    where: { id: tieId },
    select: {
      tournamentId: true,
      teamA: { select: { members: { select: { playerId: true } } } },
      teamB: { select: { members: { select: { playerId: true } } } },
    },
  });
  if (!tie) return { error: "Зустріч не знайдено — можливо, її вже видалили" };

  const teamAIds = new Set(tie.teamA.members.map((m) => m.playerId));
  const teamBIds = new Set(tie.teamB.members.map((m) => m.playerId));
  if (!sideAPlayerIds.every((id) => teamAIds.has(id))) {
    return { error: "Гравець сторони А має бути учасником команди А цієї зустрічі" };
  }
  if (!sideBPlayerIds.every((id) => teamBIds.has(id))) {
    return { error: "Гравець сторони Б має бути учасником команди Б цієї зустрічі" };
  }

  let created;
  try {
    created = await prisma.padelMatch.create({
      data: {
        tournamentId: tie.tournamentId,
        tieId,
        matchType,
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
      return { error: "Зустріч або гравець не знайдено — можливо, їх вже видалили" };
    }
    throw error;
  }

  after(() =>
    logAudit(session.user, {
      action: "padel.match.create",
      entityType: "PadelMatch",
      entityId: created.id,
      summary: `Створено раббер (Падел, ${matchType}) у зустрічі ${tieId}`,
    }),
  );

  revalidatePath(`/admin/padel/tournaments/${tie.tournamentId}`);
  revalidatePath(`/padel/tournaments/${tie.tournamentId}`);
  updateTag(PADEL_STATS_CACHE_TAG);
  schedulePadelRatingSnapshotRefresh();
  return { success: true };
}