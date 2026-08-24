import { prisma } from "@/lib/db";
import { computeMatchPoints } from "@/lib/match-result";
import { getPadelTournamentStandings } from "@/lib/padel-stats";
import { displayName } from "@/lib/player-display";
import { FINAL_ROUND, isPlayoffRound, MINI_GROUP_ROUND } from "@/lib/playoff-rounds";
import { resolveGroupLabel } from "@/lib/randomize-pairs";
import type { PlayoffResult } from "@/lib/rating/placement";
import { PLACEMENT_ROUND_RANKS, resolveDecisivePlacements } from "@/lib/rating/placement";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { isRoundRobinComplete, recordHeadToHead, sortRows } from "@/lib/standings-sort";
import type { TournamentFormat } from "@/lib/validation/tournament";

// Padel twin of tournament-standings.ts - identical logic ported onto the
// Padel* models (prisma.padelMatch/padelTournamentGroup instead of
// prisma.match/tournamentGroup, getPadelTournamentStandings instead of
// getTournamentStandings). Every grouping/placement rule (built-in groups,
// custom "Додаткові групи", Gold/Silver seeded split, GROUPS_12_PLAYOFF
// combined table, doubles team pairing) is unchanged - see the original
// file's doc comments for the full rationale behind each.

export type { StandingsRow };

async function getIndividualRows(
  tournamentId: string,
  participants: {
    playerId: string;
    seed: number | null;
    player: { id: string; name: string; nickname?: string | null };
  }[],
): Promise<{ rows: StandingsRow[]; matches: CompletedMatchRow[] }> {
  const [standings, matches] = await Promise.all([
    getPadelTournamentStandings(tournamentId),
    prisma.padelMatch.findMany({
      where: { tournamentId, status: "COMPLETED", winnerSide: { not: null } },
      select: {
        round: true,
        winnerSide: true,
        players: { select: { side: true, playerId: true } },
        sets: { select: { sideAGames: true, sideBGames: true } },
        walkover: true,
        retired: true,
      },
    }),
  ]);

  const points = new Map<string, number>();
  for (const match of matches) {
    const matchPoints = computeMatchPoints(match.sets, match.winnerSide, match.retired);
    for (const p of match.players) {
      const earned = p.side === "A" ? matchPoints.A : matchPoints.B;
      points.set(p.playerId, (points.get(p.playerId) ?? 0) + earned);
    }
  }

  const rows = participants.map((entry) => {
    const s = standings.get(entry.playerId);
    return {
      key: entry.playerId,
      label: displayName(entry.player),
      href: `/players/${entry.playerId}`,
      matchesPlayed: s?.matchesPlayed ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      winPct: s?.winPct ?? 0,
      gamesWon: s?.gamesWon ?? 0,
      gamesLost: s?.gamesLost ?? 0,
      points: points.get(entry.playerId) ?? 0,
      seed: entry.seed !== null,
    };
  });
  return { rows, matches };
}

type CompletedMatchRow = {
  round: string | null;
  winnerSide: "A" | "B" | null;
  players: { side: "A" | "B"; playerId: string }[];
  sets: { sideAGames: number; sideBGames: number }[];
  retired: boolean;
  walkover: boolean;
};

function buildScopedSinglesRows(
  matches: CompletedMatchRow[],
  members: { playerId: string; seed: number | null; player: { name: string; nickname?: string | null } }[],
  roundFilter?: string,
  otherRoundNames?: Set<string>,
  includeAllRounds = false,
): { rows: StandingsRow[]; h2h: HeadToHead } {
  const memberIds = new Set(members.map((m) => m.playerId));
  const scopedMatches = matches.filter((m) => {
    if (!m.players.every((p) => memberIds.has(p.playerId))) return false;
    if (includeAllRounds) return true;
    if (roundFilter !== undefined) return m.round === roundFilter;
    if (m.round == null) return true;
    return !isPlayoffRound(m.round) && !otherRoundNames?.has(m.round);
  });

  const h2h: HeadToHead = new Map();
  const stats = new Map<
    string,
    { matchesPlayed: number; wins: number; losses: number; gamesWon: number; gamesLost: number; points: number }
  >();

  for (const match of scopedMatches) {
    const winners = match.players.filter((p) => p.side === match.winnerSide);
    const losers = match.players.filter((p) => p.side !== match.winnerSide);
    for (const winner of winners) {
      for (const loser of losers) recordHeadToHead(h2h, winner.playerId, loser.playerId);
    }

    const matchPoints = computeMatchPoints(match.sets, match.winnerSide, match.retired);
    const gamesA = match.sets.reduce((sum, s) => sum + s.sideAGames, 0);
    const gamesB = match.sets.reduce((sum, s) => sum + s.sideBGames, 0);

    for (const p of match.players) {
      if (match.walkover && p.side !== match.winnerSide) continue;

      const entry = stats.get(p.playerId) ?? {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        points: 0,
      };
      entry.matchesPlayed += 1;
      if (p.side === match.winnerSide) entry.wins += 1;
      else entry.losses += 1;
      entry.gamesWon += p.side === "A" ? gamesA : gamesB;
      entry.gamesLost += p.side === "A" ? gamesB : gamesA;
      entry.points += p.side === "A" ? matchPoints.A : matchPoints.B;
      stats.set(p.playerId, entry);
    }
  }

  const rows: StandingsRow[] = members.map((m) => {
    const s = stats.get(m.playerId);
    return {
      key: m.playerId,
      label: displayName(m.player),
      href: `/players/${m.playerId}`,
      matchesPlayed: s?.matchesPlayed ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      winPct: s && s.matchesPlayed > 0 ? Math.round((s.wins / s.matchesPlayed) * 100) : 0,
      gamesWon: s?.gamesWon ?? 0,
      gamesLost: s?.gamesLost ?? 0,
      points: s?.points ?? 0,
      seed: m.seed !== null,
    };
  });
  return { rows, h2h };
}

type DoublesMatchRow = Awaited<ReturnType<typeof fetchDoublesMatches>>[number];

function fetchDoublesMatches(tournamentId: string) {
  return prisma.padelMatch.findMany({
    where: { tournamentId, matchType: "DOUBLES", status: { not: "CANCELLED" } },
    select: {
      round: true,
      status: true,
      winnerSide: true,
      players: {
        select: { side: true, playerId: true, player: { select: { name: true, nickname: true } } },
      },
      sets: { select: { sideAGames: true, sideBGames: true } },
      retired: true,
    },
  });
}

function buildTeamRows(matches: DoublesMatchRow[]): { rows: StandingsRow[]; h2h: HeadToHead } {
  const teams = new Map<
    string,
    { label: string; wins: number; losses: number; gamesWon: number; gamesLost: number; points: number }
  >();
  const h2h: HeadToHead = new Map();

  for (const match of matches) {
    const teamKeyBySide: Partial<Record<"A" | "B", string>> = {};
    const matchPoints =
      match.status === "COMPLETED" && match.winnerSide
        ? computeMatchPoints(match.sets, match.winnerSide, match.retired)
        : null;

    for (const side of ["A", "B"] as const) {
      const sidePlayers = match.players
        .filter((p) => p.side === side)
        .sort((a, b) => a.playerId.localeCompare(b.playerId));
      if (sidePlayers.length === 0) continue;

      const key = sidePlayers.map((p) => p.playerId).join("+");
      teamKeyBySide[side] = key;
      const entry = teams.get(key) ?? {
        label: sidePlayers.map((p) => displayName(p.player)).join(" / "),
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

export type StandingsGroup = {
  label: string;
  rows: StandingsRow[];
  roundRobinDone: boolean;
  id?: string;
};

export type StandingsGrouping = { title: string | null; groups: StandingsGroup[] };

export type PlacedStandingsRow = StandingsRow & { place: number | null };

export type PlacedTable = { rows: PlacedStandingsRow[]; complete: boolean };

export type FormatRulesKind = "GROUPS_12_PLAYOFF" | "CUSTOM_GROUPS" | "SEEDED_SPLIT";

export type TournamentStandingsResult = (
  | { mode: "individual"; rows: StandingsRow[]; roundRobinDone: boolean }
  | { mode: "grouped"; groupings: StandingsGrouping[] }
) & {
  placedTable?: PlacedTable;
  formatRulesKind?: FormatRulesKind;
};

function buildGroup(label: string, rows: StandingsRow[], h2h: HeadToHead, id?: string): StandingsGroup {
  const sorted = sortRows(rows, h2h);
  return { label, rows: sorted, roundRobinDone: isRoundRobinComplete(rows, h2h), id };
}

/** Padel twin of getTournamentStandingsRows - see its doc comment for the full rationale. */
export async function getPadelTournamentStandingsRows(
  tournamentId: string,
  format: TournamentFormat,
  participants: {
    playerId: string;
    seed: number | null;
    group: number | null;
    withdrawnAt?: Date | string | null;
    player: { id: string; name: string; nickname?: string | null };
  }[],
): Promise<TournamentStandingsResult> {
  const customGroups = await prisma.padelTournamentGroup.findMany({
    where: { tournamentId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, name: true, members: { select: { playerId: true } } },
  });
  const customGroupNames = new Map(customGroups.map((g) => [g.number, g.name]));
  const customGroupNameSet = new Set(customGroups.map((g) => g.name));

  if (format === "DOUBLES") {
    const doublesMatches = await fetchDoublesMatches(tournamentId);
    const { rows } = buildTeamRows(doublesMatches);

    const groupByPlayerId = new Map(participants.map((p) => [p.playerId, p.group]));
    const teamGroup = (rowKey: string): number | null => {
      const [a, b] = rowKey.split("+");
      const groupA = groupByPlayerId.get(a) ?? null;
      const groupB = groupByPlayerId.get(b) ?? null;
      return groupA !== null && groupA === groupB ? groupA : null;
    };
    const isUngroupedTeam = (rowKey: string): boolean => {
      const [a, b] = rowKey.split("+");
      return (groupByPlayerId.get(a) ?? null) === null && (groupByPlayerId.get(b) ?? null) === null;
    };

    const teamGroupIds = new Set(rows.map((r) => teamGroup(r.key)).filter((g): g is number => g != null));
    const participantGroupIds = new Set(
      participants.filter((p) => p.group != null).map((p) => p.group!),
    );
    const groupIds = [...new Set([...teamGroupIds, ...participantGroupIds])].sort((a, b) => a - b);
    const hasUngroupedRemainder = rows.some((r) => isUngroupedTeam(r.key));

    const buildDoublesGroup = (
      label: string,
      memberIds: Set<string>,
      groupId?: string,
      roundFilter?: string,
    ): StandingsGroup => {
      const scopedMatches = doublesMatches.filter((m) => {
        if (!m.players.every((p) => memberIds.has(p.playerId))) return false;
        if (roundFilter !== undefined) return m.round === roundFilter;
        if (m.round == null) return true;
        return !isPlayoffRound(m.round) && !customGroupNameSet.has(m.round);
      });
      const { rows: teamRowsForGroup, h2h: groupH2h } = buildTeamRows(scopedMatches);
      const pairedPlayerIds = new Set(teamRowsForGroup.flatMap((r) => r.key.split("+")));
      const placeholderRows: StandingsRow[] = participants
        .filter((p) => memberIds.has(p.playerId) && !pairedPlayerIds.has(p.playerId))
        .map((p) => ({
          key: p.playerId,
          label: displayName(p.player),
          href: `/players/${p.playerId}`,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          winPct: 0,
          gamesWon: 0,
          gamesLost: 0,
          points: 0,
        }));
      return buildGroup(label, [...teamRowsForGroup, ...placeholderRows], groupH2h, groupId);
    };

    const groupings: StandingsGrouping[] = [];

    const hasBuiltInGroups = groupIds.length + (hasUngroupedRemainder ? 1 : 0) >= 2;
    if (hasBuiltInGroups) {
      groupings.push({
        title: "За групами",
        groups: [
          ...groupIds.map((groupId) => {
            const memberIds = new Set(participants.filter((p) => p.group === groupId).map((p) => p.playerId));
            return buildDoublesGroup(resolveGroupLabel(groupId, customGroupNames), memberIds);
          }),
          ...(hasUngroupedRemainder
            ? [
                buildDoublesGroup(
                  "Без групи",
                  new Set(participants.filter((p) => p.group == null).map((p) => p.playerId)),
                ),
              ]
            : []),
        ],
      });
    }

    const customGroupSections = customGroups.map((cg) => {
      const memberIds = new Set(cg.members.map((m) => m.playerId));
      return buildDoublesGroup(cg.name, memberIds, cg.id, cg.name);
    });
    if (customGroupSections.length > 0) {
      groupings.push({ title: "Додаткові групи", groups: customGroupSections });
    }

    if (groupings.length === 1) groupings[0] = { ...groupings[0], title: null };
    const formatRulesKind = hasBuiltInGroups ? "CUSTOM_GROUPS" : undefined;
    const placedTable = buildGeneralPlacedTableForTeams(doublesMatches, rows) ?? undefined;
    if (groupings.length > 0) return { mode: "grouped", groupings, placedTable, formatRulesKind };

    const groupStage = buildTeamRows(doublesMatches.filter((m) => !isPlayoffRound(m.round)));
    return {
      mode: "individual",
      rows: sortRows(groupStage.rows, groupStage.h2h),
      roundRobinDone: isRoundRobinComplete(groupStage.rows, groupStage.h2h),
      placedTable,
      formatRulesKind,
    };
  }

  const { rows, matches } = await getIndividualRows(tournamentId, participants);

  const groups12Playoff = await buildGroups12PlayoffTable(tournamentId, rows, participants);
  const placedTable = groups12Playoff?.table ?? buildGeneralPlacedTable(matches, rows, participants) ?? undefined;

  const groupIds = [...new Set(participants.filter((p) => p.group != null).map((p) => p.group!))].sort(
    (a, b) => a - b,
  );
  const hasUngroupedParticipant = participants.some((p) => p.group == null);
  const seededIds = new Set(participants.filter((p) => p.seed !== null).map((p) => p.playerId));
  const hasGroups = groupIds.length + (hasUngroupedParticipant ? 1 : 0) >= 2;
  const hasSeeds = seededIds.size > 0 && !groups12Playoff && !hasGroups;

  const buildSinglesGroup = (
    label: string,
    members: { playerId: string; seed: number | null; player: { name: string; nickname?: string | null } }[],
    groupId?: string,
    roundFilter?: string,
  ): StandingsGroup => {
    const scoped = buildScopedSinglesRows(matches, members, roundFilter, customGroupNameSet);
    return buildGroup(label, scoped.rows, scoped.h2h, groupId);
  };

  const groupings: StandingsGrouping[] = [];
  if (hasGroups) {
    groupings.push({
      title: "За групами",
      groups: [
        ...groupIds.map((groupId) =>
          buildSinglesGroup(
            resolveGroupLabel(groupId, customGroupNames),
            participants.filter((p) => p.group === groupId),
          ),
        ),
        ...(hasUngroupedParticipant
          ? [buildSinglesGroup("Без групи", participants.filter((p) => p.group == null))]
          : []),
        ...(groups12Playoff ? [groups12Playoff.miniGroup] : []),
      ],
    });
  }
  if (hasSeeds) {
    groupings.push({
      title: "За сіяністю",
      groups: [
        buildSinglesGroup("Gold (сіяні)", participants.filter((p) => seededIds.has(p.playerId))),
        buildSinglesGroup("Silver (несіяні)", participants.filter((p) => !seededIds.has(p.playerId))),
      ],
    });
  }

  const customGroupSections = customGroups.map((cg) => {
    const memberIds = new Set(cg.members.map((m) => m.playerId));
    return buildSinglesGroup(
      cg.name,
      participants.filter((p) => memberIds.has(p.playerId)),
      cg.id,
      cg.name,
    );
  });
  if (customGroupSections.length > 0) {
    groupings.push({ title: "Додаткові групи", groups: customGroupSections });
  }

  const formatRulesKind: FormatRulesKind | undefined = groups12Playoff
    ? "GROUPS_12_PLAYOFF"
    : hasGroups
      ? "CUSTOM_GROUPS"
      : hasSeeds
        ? "SEEDED_SPLIT"
        : undefined;
  if (groupings.length === 0) {
    const groupStage = buildScopedSinglesRows(matches, participants, undefined, customGroupNameSet);
    return {
      mode: "individual",
      rows: sortRows(groupStage.rows, groupStage.h2h),
      roundRobinDone: isRoundRobinComplete(groupStage.rows, groupStage.h2h),
      placedTable,
      formatRulesKind,
    };
  }
  if (groupings.length === 1) groupings[0] = { ...groupings[0], title: null };
  return { mode: "grouped", groupings, placedTable, formatRulesKind };
}

function buildGeneralPlacedTableForTeams(matches: DoublesMatchRow[], teamRows: StandingsRow[]): PlacedTable | null {
  const playoffResults: PlayoffResult[] = matches.flatMap((m) => {
    if (m.status !== "COMPLETED" || !m.winnerSide || !m.round || !(m.round in PLACEMENT_ROUND_RANKS)) {
      return [];
    }
    const teamKey = (side: "A" | "B") =>
      m.players
        .filter((p) => p.side === side)
        .sort((a, b) => a.playerId.localeCompare(b.playerId))
        .map((p) => p.playerId)
        .join("+");
    const winnerKey = teamKey(m.winnerSide);
    const loserKey = teamKey(m.winnerSide === "A" ? "B" : "A");
    if (!winnerKey || !loserKey) return [];
    return [{ round: m.round, winnerKey, loserKey }];
  });

  const placeByKey = resolveDecisivePlacements(playoffResults);

  // Mini-group placement rounds (e.g. "Ігри за 1-3 місце") - see
  // findMiniGroupPlacementRounds. Same mechanic as the singles twin below.
  for (const { round, startPlace } of findMiniGroupPlacementRounds(matches)) {
    const scopedMatches = matches.filter((m) => m.round === round);
    const { rows: miniRows, h2h: miniH2h } = buildTeamRows(scopedMatches);
    if (miniRows.length > 0 && isRoundRobinComplete(miniRows, miniH2h)) {
      sortRows(miniRows, miniH2h).forEach((row, i) => placeByKey.set(row.key, startPlace + i));
    }
  }
  if (placeByKey.size === 0) return null;

  const { h2h } = buildTeamRows(matches);
  const stillUnplaced = teamRows.filter((r) => !placeByKey.has(r.key));
  if (stillUnplaced.length > 0) {
    const startPlace = placeByKey.size + 1;
    sortRows(stillUnplaced, h2h).forEach((row, i) => placeByKey.set(row.key, startPlace + i));
  }

  const rows = sortByPlace(teamRows.map((row) => ({ ...row, place: placeByKey.get(row.key) ?? null })));
  const complete = rows.every((r) => r.place != null);

  return { rows, complete };
}

/**
 * A custom "Додаткові групи" round whose name reads as a place range (e.g.
 * "Ігри за 1-3 місце") - see the tennis twin in tournament-standings.ts for
 * the full rationale. Excludes MINI_GROUP_ROUND, handled separately by
 * buildGroups12PlayoffTable's own fixed 9-12 range.
 */
function findMiniGroupPlacementRounds(
  matches: { round: string | null }[],
): { round: string; startPlace: number }[] {
  const rounds = new Set(matches.flatMap((m) => (m.round ? [m.round] : [])));
  return [...rounds]
    .flatMap((round) => {
      if (round === MINI_GROUP_ROUND) return [];
      const match = round.match(/(\d+)\s*[-–—]\s*\d+\s*місц/iu);
      return match ? [{ round, startPlace: Number(match[1]) }] : [];
    })
    .sort((a, b) => a.startPlace - b.startPlace);
}

function sortByPlace(rows: PlacedStandingsRow[]): PlacedStandingsRow[] {
  return [...rows].sort((a, b) => {
    if (a.place == null && b.place == null) return a.label.localeCompare(b.label);
    if (a.place == null) return 1;
    if (b.place == null) return -1;
    return a.place - b.place;
  });
}

function buildGeneralPlacedTable(
  matches: CompletedMatchRow[],
  individualRows: StandingsRow[],
  participants: {
    playerId: string;
    seed: number | null;
    withdrawnAt?: Date | string | null;
    player: { name: string; nickname?: string | null };
  }[],
): PlacedTable | null {
  const playoffResults: PlayoffResult[] = matches.flatMap((m) => {
    if (!m.round || !(m.round in PLACEMENT_ROUND_RANKS)) return [];
    const winner = m.players.find((p) => p.side === m.winnerSide);
    const loser = m.players.find((p) => p.side !== m.winnerSide);
    return winner && loser ? [{ round: m.round, winnerKey: winner.playerId, loserKey: loser.playerId }] : [];
  });
  const placeByKey = resolveDecisivePlacements(playoffResults);

  // Mini-group placement rounds (e.g. "Ігри за 1-3 місце") - see
  // findMiniGroupPlacementRounds. Each contributes its own completed round
  // robin's order to placeByKey, same mechanic as MINI_GROUP_ROUND below.
  for (const { round, startPlace } of findMiniGroupPlacementRounds(matches)) {
    const memberIds = new Set(
      matches.filter((m) => m.round === round).flatMap((m) => m.players.map((p) => p.playerId)),
    );
    const members = participants.filter((p) => memberIds.has(p.playerId));
    const { rows: miniRows, h2h: miniH2h } = buildScopedSinglesRows(matches, members, round);
    if (miniRows.length > 0 && isRoundRobinComplete(miniRows, miniH2h)) {
      sortRows(miniRows, miniH2h).forEach((row, i) => placeByKey.set(row.key, startPlace + i));
    }
  }
  if (placeByKey.size === 0) return null;

  const withdrawnIds = new Set(participants.filter((p) => p.withdrawnAt != null).map((p) => p.playerId));
  const leftover = participants.filter((p) => !placeByKey.has(p.playerId) && !withdrawnIds.has(p.playerId));
  if (leftover.length > 0) {
    const scoped = buildScopedSinglesRows(matches, leftover, undefined, undefined, true);
    const startPlace = placeByKey.size + 1;
    sortRows(scoped.rows, scoped.h2h).forEach((row, i) => placeByKey.set(row.key, startPlace + i));
  }

  const rows = sortByPlace(individualRows.map((row) => ({ ...row, place: placeByKey.get(row.key) ?? null })));

  const complete = rows.every((r) => r.place != null || withdrawnIds.has(r.key));

  return { rows, complete };
}

async function buildGroups12PlayoffTable(
  tournamentId: string,
  individualRows: StandingsRow[],
  participants: {
    playerId: string;
    seed: number | null;
    withdrawnAt?: Date | string | null;
    player: { id: string; name: string; nickname?: string | null };
  }[],
): Promise<{ table: PlacedTable; miniGroup: StandingsGroup } | null> {
  const miniGroupMatches = await prisma.padelMatch.findMany({
    where: { tournamentId, round: MINI_GROUP_ROUND },
    select: {
      round: true,
      status: true,
      winnerSide: true,
      players: { select: { side: true, playerId: true } },
      sets: { select: { sideAGames: true, sideBGames: true } },
      walkover: true,
      retired: true,
    },
  });
  if (miniGroupMatches.length === 0) return null;

  const decisiveMatches = await prisma.padelMatch.findMany({
    where: {
      tournamentId,
      round: { in: [FINAL_ROUND, "За 3 місце", "За 5 місце", "За 7 місце"] },
      status: "COMPLETED",
      winnerSide: { not: null },
    },
    select: {
      round: true,
      winnerSide: true,
      players: { select: { side: true, playerId: true } },
    },
  });
  const playoffResults: PlayoffResult[] = decisiveMatches.flatMap((m) => {
    const winner = m.players.find((p) => p.side === m.winnerSide);
    const loser = m.players.find((p) => p.side !== m.winnerSide);
    return winner && loser ? [{ round: m.round!, winnerKey: winner.playerId, loserKey: loser.playerId }] : [];
  });
  const placeByKey = resolveDecisivePlacements(playoffResults);

  const miniGroupPlayerIds = new Set(miniGroupMatches.flatMap((m) => m.players.map((p) => p.playerId)));
  const miniMembers = participants.filter((p) => miniGroupPlayerIds.has(p.playerId));
  const completedMiniMatches = miniGroupMatches.filter((m) => m.status === "COMPLETED" && m.winnerSide != null);
  const { rows: miniRows, h2h: miniH2h } = buildScopedSinglesRows(
    completedMiniMatches,
    miniMembers,
    MINI_GROUP_ROUND,
  );
  if (isRoundRobinComplete(miniRows, miniH2h)) {
    sortRows(miniRows, miniH2h).forEach((row, i) => placeByKey.set(row.key, 9 + i));
  }

  const rows = sortByPlace(individualRows.map((row) => ({ ...row, place: placeByKey.get(row.key) ?? null })));

  const miniGroup = buildGroup(MINI_GROUP_ROUND, miniRows, miniH2h);

  const withdrawnIds = new Set(
    participants.filter((p) => p.withdrawnAt != null).map((p) => p.playerId),
  );
  const complete = rows.every((r) => r.place != null || withdrawnIds.has(r.key));

  return { table: { rows, complete }, miniGroup };
}
