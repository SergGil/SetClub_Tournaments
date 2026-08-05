import { prisma } from "@/lib/db";
import { computeMatchPoints } from "@/lib/match-result";
import { groupRoundLabel } from "@/lib/randomize-pairs";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { isRoundRobinComplete, recordHeadToHead, sortRows } from "@/lib/standings-sort";
import { getTournamentStandings } from "@/lib/stats";
import type { TournamentFormat } from "@/lib/validation/tournament";

export type { StandingsRow };

async function getIndividualRows(
  tournamentId: string,
  participants: { playerId: string; player: { id: string; name: string } }[],
): Promise<{ rows: StandingsRow[]; h2h: HeadToHead }> {
  const [standings, matches] = await Promise.all([
    getTournamentStandings(tournamentId),
    prisma.match.findMany({
      where: { tournamentId, status: "COMPLETED", winnerSide: { not: null } },
      select: {
        winnerSide: true,
        players: { select: { side: true, playerId: true } },
        sets: { select: { sideAGames: true, sideBGames: true } },
      },
    }),
  ]);

  const h2h: HeadToHead = new Map();
  const points = new Map<string, number>();
  for (const match of matches) {
    const winners = match.players.filter((p) => p.side === match.winnerSide);
    const losers = match.players.filter((p) => p.side !== match.winnerSide);
    for (const winner of winners) {
      for (const loser of losers) {
        recordHeadToHead(h2h, winner.playerId, loser.playerId);
      }
    }

    const matchPoints = computeMatchPoints(match.sets);
    for (const p of match.players) {
      const earned = p.side === "A" ? matchPoints.A : matchPoints.B;
      points.set(p.playerId, (points.get(p.playerId) ?? 0) + earned);
    }
  }

  const rows = participants.map((entry) => {
    const s = standings.get(entry.playerId);
    return {
      key: entry.playerId,
      label: entry.player.name,
      href: `/players/${entry.playerId}`,
      matchesPlayed: s?.matchesPlayed ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      winPct: s?.winPct ?? 0,
      gamesWon: s?.gamesWon ?? 0,
      gamesLost: s?.gamesLost ?? 0,
      points: points.get(entry.playerId) ?? 0,
    };
  });
  return { rows, h2h };
}

/**
 * Doubles standings grouped by the exact pair of players who played each side
 * together. Teams show up as soon as they have a scheduled match (0-0), not
 * only once they've completed one - otherwise a freshly-drawn bracket with
 * no scores entered yet looks like an empty roster.
 */
async function getTeamRows(tournamentId: string): Promise<{ rows: StandingsRow[]; h2h: HeadToHead }> {
  const matches = await prisma.match.findMany({
    where: { tournamentId, matchType: "DOUBLES", status: { not: "CANCELLED" } },
    select: {
      status: true,
      winnerSide: true,
      players: { select: { side: true, playerId: true, player: { select: { name: true } } } },
      sets: { select: { sideAGames: true, sideBGames: true } },
    },
  });

  const teams = new Map<
    string,
    { label: string; wins: number; losses: number; gamesWon: number; gamesLost: number; points: number }
  >();
  const h2h: HeadToHead = new Map();

  for (const match of matches) {
    const teamKeyBySide: Partial<Record<"A" | "B", string>> = {};
    const matchPoints = match.status === "COMPLETED" && match.winnerSide ? computeMatchPoints(match.sets) : null;

    for (const side of ["A", "B"] as const) {
      const sidePlayers = match.players
        .filter((p) => p.side === side)
        .sort((a, b) => a.playerId.localeCompare(b.playerId));
      if (sidePlayers.length === 0) continue;

      const key = sidePlayers.map((p) => p.playerId).join("+");
      teamKeyBySide[side] = key;
      const entry = teams.get(key) ?? {
        label: sidePlayers.map((p) => p.player.name).join(" / "),
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        points: 0,
      };
      if (match.status === "COMPLETED" && match.winnerSide) {
        if (match.winnerSide === side) entry.wins += 1;
        else entry.losses += 1;
      }
      for (const set of match.sets) {
        if (side === "A") {
          entry.gamesWon += set.sideAGames;
          entry.gamesLost += set.sideBGames;
        } else {
          entry.gamesWon += set.sideBGames;
          entry.gamesLost += set.sideAGames;
        }
      }
      if (matchPoints) {
        entry.points += side === "A" ? matchPoints.A : matchPoints.B;
      }
      teams.set(key, entry);
    }

    if (match.status === "COMPLETED" && match.winnerSide) {
      const winnerKey = teamKeyBySide[match.winnerSide];
      const loserKey = teamKeyBySide[match.winnerSide === "A" ? "B" : "A"];
      if (winnerKey && loserKey) recordHeadToHead(h2h, winnerKey, loserKey);
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

export type StandingsGroup = { label: string; rows: StandingsRow[]; roundRobinDone: boolean };

/** One way of splitting the same players into brackets - `title` is only shown when more than one grouping is active at once. */
export type StandingsGrouping = { title: string | null; groups: StandingsGroup[] };

export type TournamentStandingsResult =
  | { grouped: false; rows: StandingsRow[]; roundRobinDone: boolean }
  | { grouped: true; groupings: StandingsGrouping[] };

function buildGroup(label: string, rows: StandingsRow[], h2h: HeadToHead): StandingsGroup {
  const sorted = sortRows(rows, h2h);
  return { label, rows: sorted, roundRobinDone: isRoundRobinComplete(rows, h2h) };
}

/**
 * DOUBLES tournaments are ranked by team (the pair that played together), since an
 * individual player's win/loss record there depends entirely on their rotating
 * partner. SINGLES and MIXED tournaments rank individual players, potentially
 * shown as two independent groupings side by side: an admin-assigned round-robin
 * `group` split (1-6, matching the singles randomizer's "За групами" strategy)
 * and a seeded ("Gold") / unseeded ("Silver") split (matching "За сіяністю") -
 * a tournament can use either, both, or neither; each is computed independently
 * off the same underlying rows.
 */
export async function getTournamentStandingsRows(
  tournamentId: string,
  format: TournamentFormat,
  participants: {
    playerId: string;
    seed: number | null;
    group: number | null;
    player: { id: string; name: string };
  }[],
): Promise<TournamentStandingsResult> {
  if (format === "DOUBLES") {
    const { rows, h2h } = await getTeamRows(tournamentId);

    // A team's key is its two playerIds joined by "+" (see getTeamRows) - a
    // team belongs to an admin-assigned group only when both its players
    // share the same non-null group (the doubles "За групами" randomizer
    // only ever forms teams within one group, but a team could still exist
    // without ever going through it - e.g. a manually created match).
    const groupByPlayerId = new Map(participants.map((p) => [p.playerId, p.group]));
    const teamGroup = (rowKey: string): number | null => {
      const [a, b] = rowKey.split("+");
      const groupA = groupByPlayerId.get(a) ?? null;
      const groupB = groupByPlayerId.get(b) ?? null;
      return groupA !== null && groupA === groupB ? groupA : null;
    };

    const groupIds = [
      ...new Set(rows.map((r) => teamGroup(r.key)).filter((g): g is number => g != null)),
    ].sort((a, b) => a - b);

    if (groupIds.length >= 2) {
      return {
        grouped: true,
        groupings: [
          {
            title: null,
            groups: groupIds.map((groupId) =>
              buildGroup(groupRoundLabel(groupId), rows.filter((r) => teamGroup(r.key) === groupId), h2h),
            ),
          },
        ],
      };
    }

    return { grouped: false, rows: sortRows(rows, h2h), roundRobinDone: isRoundRobinComplete(rows, h2h) };
  }

  const { rows, h2h } = await getIndividualRows(tournamentId, participants);

  const groupIds = [...new Set(participants.filter((p) => p.group != null).map((p) => p.group!))].sort(
    (a, b) => a - b,
  );
  const seededIds = new Set(participants.filter((p) => p.seed !== null).map((p) => p.playerId));
  const hasGroups = groupIds.length >= 2;
  const hasSeeds = seededIds.size > 0;
  const showBothTitles = hasGroups && hasSeeds;

  const groupings: StandingsGrouping[] = [];
  if (hasGroups) {
    groupings.push({
      title: showBothTitles ? "За групами" : null,
      groups: groupIds.map((groupId) => {
        const playerIds = new Set(participants.filter((p) => p.group === groupId).map((p) => p.playerId));
        return buildGroup(groupRoundLabel(groupId), rows.filter((r) => playerIds.has(r.key)), h2h);
      }),
    });
  }
  if (hasSeeds) {
    groupings.push({
      title: showBothTitles ? "За сіяністю" : null,
      groups: [
        buildGroup("Gold (сіяні)", rows.filter((r) => seededIds.has(r.key)), h2h),
        buildGroup("Silver (несіяні)", rows.filter((r) => !seededIds.has(r.key)), h2h),
      ],
    });
  }

  if (groupings.length === 0) {
    return { grouped: false, rows: sortRows(rows, h2h), roundRobinDone: isRoundRobinComplete(rows, h2h) };
  }
  return { grouped: true, groupings };
}
