/**
 * One-off backfill of Match.preMatchWinProbA / PadelMatch.preMatchWinProbA
 * for matches completed before saveScoreCore started freezing it - see
 * docs/RATING.md ("Прогноз після матчу") and reconstructPreMatchWinProbs.
 *
 *   npx jiti scripts/backfill-pre-match-win-prob.ts           # dry run: prints what it would write
 *   npx jiti scripts/backfill-pre-match-win-prob.ts --apply   # writes
 *
 * Reads DATABASE_URL from .env (which points at the production Neon DB). The
 * dry run never touches the new column, so it also works before the
 * migration is applied.
 *
 * Run it AFTER the code deploy (migration -> deploy -> this): a match the old
 * code completes in between gets no frozen value, and only a run after the
 * deploy picks it up.
 *
 * --apply only writes non-null values into rows that are still NULL, so a
 * probability frozen at save time is never overwritten. NULL is ambiguous,
 * though: it's also what saveScoreCore freezes when there was no prediction
 * (a player with no rating yet) or when computing it failed. Such a row gets
 * the reconstruction - for a tournament scored live that's the very same
 * rating state, so it normally comes out null again and nothing is written.
 * It differs only if earlier-dated results were added later, or the live
 * calculation had failed (where filling it in is the point). Re-running is
 * therefore safe.
 *
 * Relative imports only: this runs outside Next, without the "@/" alias.
 */
import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";
import { reconstructPreMatchWinProbs } from "../src/lib/rating/pre-match-reconstruction";
import type { ReconstructionRow } from "../src/lib/rating/pre-match-reconstruction";

type Sport = "TENNIS" | "PADEL";
type Scope = "general" | "women";
type Format = "SINGLES" | "DOUBLES";

const apply = process.argv.includes("--apply");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

// Same filters and the same per-row mapping as fetchRatingMatchRows /
// fetchPadelRatingMatchRows, plus completedAt.
const select = {
  id: true,
  tournamentId: true,
  tournament: { select: { startDate: true, participants: { select: { playerId: true, seed: true } } } },
  winnerSide: true,
  createdAt: true,
  completedAt: true,
  round: true,
  players: { select: { side: true, playerId: true } },
  sets: { select: { sideAGames: true, sideBGames: true } },
} as const;

async function fetchRows(sport: Sport, scope: Scope, matchType: Format): Promise<ReconstructionRow[]> {
  const where = {
    status: "COMPLETED" as const,
    winnerSide: { not: null },
    matchType,
    walkover: false,
    tournament: { isWomensOnly: scope === "women" },
  };
  const rows =
    sport === "TENNIS"
      ? await prisma.match.findMany({ where, select })
      : await prisma.padelMatch.findMany({ where, select });
  return rows.map((row) => {
    const seededByPlayer = new Map(row.tournament.participants.map((p) => [p.playerId, p.seed !== null]));
    const tournamentStartDate = row.tournament.startDate.getTime();
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      tournamentStartDate,
      winnerSide: row.winnerSide as "A" | "B",
      createdAt: row.createdAt.getTime(),
      // Every completed match on prod has one (checked 2026-11-13); the
      // fallback just keeps a hypothetical legacy row in tournament order.
      completedAt: row.completedAt?.getTime() ?? tournamentStartDate,
      round: row.round,
      tournamentParticipantCount: row.tournament.participants.length,
      players: row.players.map((p) => ({
        side: p.side,
        playerId: p.playerId,
        seeded: seededByPlayer.get(p.playerId) ?? false,
      })),
      sets: row.sets,
    };
  });
}

async function main() {
  const pools = (["TENNIS", "PADEL"] as const).flatMap((sport) =>
    (["general", "women"] as const).flatMap((scope) =>
      (["SINGLES", "DOUBLES"] as const).map((matchType) => ({ sport, scope, matchType })),
    ),
  );
  // All reads at once - the run is dominated by DB round trips, not by the
  // reconstruction itself (tens of milliseconds for the whole club).
  const [femalePlayers, ...poolRows] = await Promise.all([
    prisma.player.findMany({ where: { gender: "FEMALE" }, select: { id: true } }),
    ...pools.map(({ sport, scope, matchType }) => fetchRows(sport, scope, matchType)),
  ]);
  const femaleIds = new Set(femalePlayers.map((p) => p.id));

  const toWrite: { sport: Sport; id: string; probA: number }[] = [];
  pools.forEach(({ sport, scope, matchType }, i) => {
    const rows = poolRows[i];
    if (rows.length === 0) return;
    const probs = reconstructPreMatchWinProbs(rows, matchType, scope === "women" ? femaleIds : null);
    let withPrediction = 0;
    for (const [id, probA] of probs) {
      if (probA == null) continue;
      withPrediction++;
      toWrite.push({ sport, id, probA });
    }
    console.log(
      `${sport} ${scope} ${matchType}: ${rows.length} matches, ${withPrediction} with a prediction, ` +
        `${rows.length - withPrediction} without (a player had no rating yet)`,
    );
  });

  if (!apply) {
    console.log(`\nDry run - ${toWrite.length} values would be written. Re-run with --apply to write them.`);
    return;
  }

  let written = 0;
  const CHUNK = 50;
  for (let i = 0; i < toWrite.length; i += CHUNK) {
    const chunk = toWrite.slice(i, i + CHUNK);
    // Raw SQL, like freezePreMatchWinProbA: updateMany would bump @updatedAt -
    // the score form's optimistic-concurrency token - on every old match,
    // although filling in a derived value isn't an edit.
    const results = await prisma.$transaction(
      chunk.map(({ sport, id, probA }) =>
        sport === "TENNIS"
          ? prisma.$executeRaw`UPDATE "matches" SET "preMatchWinProbA" = ${probA} WHERE "id" = ${id} AND "preMatchWinProbA" IS NULL`
          : prisma.$executeRaw`UPDATE "padel_matches" SET "preMatchWinProbA" = ${probA} WHERE "id" = ${id} AND "preMatchWinProbA" IS NULL`,
      ),
    );
    written += results.reduce((sum, count) => sum + count, 0);
  }
  console.log(`\nWrote ${written} of ${toWrite.length} (the rest already had a frozen value).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
