import { prisma } from "@/lib/db";
import { pairKey } from "@/lib/randomize-pairs";

export type PairHistoryTournament = { id: string; startDate: Date; createdAt: Date; isWomensOnly: boolean };

/**
 * Teams (as pairKey) of the last *played* doubles tournament before `current` -
 * the pairs the doubles randomizer avoids repeating (see drawAvoidingPairs and
 * docs/DOUBLES_NO_REPEAT_PAIRS.md).
 *
 * - "Last" is counted separately for women's-only and general tournaments: a
 *   women's draw looks back at the previous women's doubles tournament, a
 *   general draw at the previous general one.
 * - "Played" = at least one COMPLETED match. The tournament's own status is
 *   set by hand and may lag behind.
 * - "Before" = earlier startDate, or the same day but created earlier, so
 *   re-running an older tournament's draw never looks at a newer one.
 *
 * A pair is two players on the same side of a match - a doubles tournament
 * keeps the same teams across all of its matches. Empty when there's no such
 * tournament yet.
 */
export async function getLastDoublesTournamentPairs(current: PairHistoryTournament): Promise<Set<string>> {
  const last = await prisma.tournament.findFirst({
    where: {
      id: { not: current.id },
      format: "DOUBLES",
      isWomensOnly: current.isWomensOnly,
      matches: { some: { status: "COMPLETED" } },
      OR: [
        { startDate: { lt: current.startDate } },
        { startDate: current.startDate, createdAt: { lt: current.createdAt } },
      ],
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: {
      matches: {
        where: { matchType: "DOUBLES" },
        select: { players: { select: { side: true, playerId: true } } },
      },
    },
  });

  const pairs = new Set<string>();
  for (const match of last?.matches ?? []) {
    for (const side of ["A", "B"] as const) {
      const ids = match.players.filter((p) => p.side === side).map((p) => p.playerId);
      if (ids.length === 2) pairs.add(pairKey(ids[0], ids[1]));
    }
  }
  return pairs;
}
