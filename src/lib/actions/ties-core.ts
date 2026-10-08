import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import type { ActionState } from "@/lib/actions/matches";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireDomainAdmin } from "@/lib/permissions";
import { isForeignKeyError } from "@/lib/prisma-errors";
import { scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";
import { STATS_CACHE_TAG } from "@/lib/stats";
import type { RubberFormInput } from "@/lib/validation/rubber";

/**
 * Creates one rubber (a normal SINGLES/DOUBLES Match, tagged with tieId) for
 * a tie. Deliberately a separate action from createMatchAction (see
 * docs/TOURNAMENT_TEAMS.md) - the key difference is the roster check below,
 * scoped to the tie's own two teams rather than the whole tournament roster.
 * Editing/scoring/deleting a rubber afterward reuses updateMatchAction/
 * saveScoreAction/deleteMatchAction unmodified, since a rubber is just a
 * Match row like any other.
 */
/** Shared by createRubberAction (web form) and POST /api/v1/ties/[id]/rubbers (mobile) - see docs/MOBILE_API.md. */
export async function createRubberCore(
  session: Awaited<ReturnType<typeof requireDomainAdmin>>,
  data: RubberFormInput,
): Promise<ActionState> {
  const { tieId, matchType, scheduledDate, sideAPlayerIds, sideBPlayerIds } = data;

  const tie = await prisma.tournamentTie.findUnique({
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
    created = await prisma.match.create({
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
      action: "match.create",
      entityType: "Match",
      entityId: created.id,
      summary: `Створено раббер (${matchType}) у зустрічі ${tieId}`,
    }),
  );

  revalidatePath(`/admin/tournaments/${tie.tournamentId}`);
  revalidatePath(`/tournaments/${tie.tournamentId}`);
  updateTag(STATS_CACHE_TAG);
  scheduleRatingSnapshotRefresh();
  return { success: true };
}