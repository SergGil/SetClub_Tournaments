import { prisma } from "@/lib/db";
import { computeMatchPoints } from "@/lib/match-result";
import { padelMatchWithDetailsInclude } from "@/lib/queries/padel-matches";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { isRoundRobinComplete, recordHeadToHead, sortRows } from "@/lib/standings-sort";

/** Padel twin of tournament-ties.ts - team/tie play for MIXED tournaments. See the original file's doc comment for the full rationale. */

const teamSelect = {
  id: true,
  name: true,
  members: { select: { player: { select: { id: true, name: true, nickname: true } } } },
} as const;

function flattenTeam(team: { id: string; name: string; members: { player: { id: string; name: string; nickname: string | null } }[] }) {
  return { id: team.id, name: team.name, members: team.members.map((m) => m.player) };
}

async function fetchPadelTournamentTies(tournamentId: string) {
  const ties = await prisma.padelTournamentTie.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      label: true,
      teamA: { select: teamSelect },
      teamB: { select: teamSelect },
      rubbers: {
        include: padelMatchWithDetailsInclude,
        orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  return ties.map((tie) => ({ ...tie, teamA: flattenTeam(tie.teamA), teamB: flattenTeam(tie.teamB) }));
}

export type PadelTournamentTieWithRubbers = Awaited<ReturnType<typeof fetchPadelTournamentTies>>[number];

/** Padel twin of buildTieTeamRows. */
export function buildPadelTieTeamRows(ties: PadelTournamentTieWithRubbers[]): { rows: StandingsRow[]; h2h: HeadToHead } {
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

export type PadelTeamTieStandings = {
  rows: StandingsRow[];
  roundRobinDone: boolean;
  ties: PadelTournamentTieWithRubbers[];
};

/** Padel twin of getTeamTieStandings. */
export async function getPadelTeamTieStandings(tournamentId: string): Promise<PadelTeamTieStandings> {
  const ties = await fetchPadelTournamentTies(tournamentId);
  const { rows, h2h } = buildPadelTieTeamRows(ties);
  return { rows: sortRows(rows, h2h), roundRobinDone: isRoundRobinComplete(rows, h2h), ties };
}
