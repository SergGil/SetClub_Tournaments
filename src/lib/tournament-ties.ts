import { prisma } from "@/lib/db";
import { computeMatchPoints } from "@/lib/match-result";
import { matchWithDetailsInclude } from "@/lib/queries/matches";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { isRoundRobinComplete, recordHeadToHead, sortRows } from "@/lib/standings-sort";

/**
 * Team/tie play for MIXED tournaments (see docs/TOURNAMENT_TEAMS.md) - kept
 * entirely separate from tournament-standings.ts on purpose, so the existing
 * individual/doubles standings computation there stays byte-for-byte
 * untouched by this feature's existence.
 */

const teamSelect = {
  id: true,
  name: true,
  members: { select: { player: { select: { id: true, name: true, nickname: true } } } },
} as const;

function flattenTeam(team: { id: string; name: string; members: { player: { id: string; name: string; nickname: string | null } }[] }) {
  return { id: team.id, name: team.name, members: team.members.map((m) => m.player) };
}

async function fetchTournamentTies(tournamentId: string) {
  const ties = await prisma.tournamentTie.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      label: true,
      teamA: { select: teamSelect },
      teamB: { select: teamSelect },
      rubbers: {
        include: matchWithDetailsInclude,
        orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  return ties.map((tie) => ({ ...tie, teamA: flattenTeam(tie.teamA), teamB: flattenTeam(tie.teamB) }));
}

export type TournamentTieWithRubbers = Awaited<ReturnType<typeof fetchTournamentTies>>[number];

/**
 * Team standings ranked by ties won/lost - a tie's own rubbers (createRubberAction
 * always creates side A from teamA's roster and side B from teamB's, see
 * validation there) mean a rubber's `winnerSide` maps directly onto teamA/
 * teamB, no need to re-derive team identity from current membership.
 *
 * A tie only contributes a win/loss once every one of its rubbers is
 * COMPLETED (a still-in-progress tie counts toward neither team yet) - games
 * and points, though, accumulate from whichever rubbers are already decided
 * regardless of whether the tie as a whole is. A tie whose rubbers end up
 * split evenly (no clear winner) stays a no-decision for both teams, same as
 * a real Davis Cup tie without a deciding rubber - not solved automatically.
 */
export function buildTieTeamRows(ties: TournamentTieWithRubbers[]): { rows: StandingsRow[]; h2h: HeadToHead } {
  const teams = new Map<
    string,
    { label: string; wins: number; losses: number; gamesWon: number; gamesLost: number; points: number }
  >();
  const h2h: HeadToHead = new Map();

  function ensureTeam(id: string, name: string) {
    const existing = teams.get(id);
    if (existing) return existing;
    const created = { label: name, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, points: 0 };
    teams.set(id, created);
    return created;
  }

  for (const tie of ties) {
    const teamA = ensureTeam(tie.teamA.id, tie.teamA.name);
    const teamB = ensureTeam(tie.teamB.id, tie.teamB.name);

    let teamARubbersWon = 0;
    let teamBRubbersWon = 0;
    let decidedRubberCount = 0;

    for (const rubber of tie.rubbers) {
      if (rubber.status !== "COMPLETED" || !rubber.winnerSide) continue;
      decidedRubberCount += 1;

      const matchPoints = computeMatchPoints(rubber.sets, rubber.winnerSide, rubber.retired);
      teamA.points += matchPoints.A;
      teamB.points += matchPoints.B;
      for (const set of rubber.sets) {
        teamA.gamesWon += set.sideAGames;
        teamA.gamesLost += set.sideBGames;
        teamB.gamesWon += set.sideBGames;
        teamB.gamesLost += set.sideAGames;
      }
      if (rubber.winnerSide === "A") teamARubbersWon += 1;
      else teamBRubbersWon += 1;
    }

    const allRubbersDecided = tie.rubbers.length > 0 && decidedRubberCount === tie.rubbers.length;
    if (!allRubbersDecided) continue;

    if (teamARubbersWon > teamBRubbersWon) {
      teamA.wins += 1;
      teamB.losses += 1;
      recordHeadToHead(h2h, tie.teamA.id, tie.teamB.id);
    } else if (teamBRubbersWon > teamARubbersWon) {
      teamB.wins += 1;
      teamA.losses += 1;
      recordHeadToHead(h2h, tie.teamB.id, tie.teamA.id);
    }
    // Equal rubber counts (a "tie" of ties) - no winner, no W/L for either side.
  }

  const rows = Array.from(teams.entries()).map(([key, team]) => {
    const matchesPlayed = team.wins + team.losses;
    return {
      key,
      label: team.label,
      matchesPlayed,
      wins: team.wins,
      losses: team.losses,
      winPct: matchesPlayed > 0 ? Math.round((team.wins / matchesPlayed) * 100) : 0,
      gamesWon: team.gamesWon,
      gamesLost: team.gamesLost,
      points: team.points,
    };
  });
  return { rows, h2h };
}

export type TeamTieStandings = { rows: StandingsRow[]; roundRobinDone: boolean; ties: TournamentTieWithRubbers[] };

/** Fetches every tie for a tournament plus the ranked team standings derived from them - `rows` is empty (and every UI section built on it renders nothing) for a tournament that never created a team, see docs/TOURNAMENT_TEAMS.md. */
export async function getTeamTieStandings(tournamentId: string): Promise<TeamTieStandings> {
  const ties = await fetchTournamentTies(tournamentId);
  const { rows, h2h } = buildTieTeamRows(ties);
  return { rows: sortRows(rows, h2h), roundRobinDone: isRoundRobinComplete(rows, h2h), ties };
}
