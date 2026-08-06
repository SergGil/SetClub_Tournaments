import { prisma } from "@/lib/db";
import { computeMatchPoints } from "@/lib/match-result";
import { FINAL_ROUND, MINI_GROUP_ROUND } from "@/lib/playoff-rounds";
import { resolveGroupLabel } from "@/lib/randomize-pairs";
import type { PlayoffResult } from "@/lib/rating/placement";
import { resolveDecisivePlacements } from "@/lib/rating/placement";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { isRoundRobinComplete, recordHeadToHead, sortRows } from "@/lib/standings-sort";
import { getTournamentStandings } from "@/lib/stats";
import type { TournamentFormat } from "@/lib/validation/tournament";

export type { StandingsRow };

async function getIndividualRows(
  tournamentId: string,
  participants: { playerId: string; player: { id: string; name: string } }[],
): Promise<{ rows: StandingsRow[]; h2h: HeadToHead; matches: CompletedMatchRow[] }> {
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
  return { rows, h2h, matches };
}

type CompletedMatchRow = {
  winnerSide: "A" | "B" | null;
  players: { side: "A" | "B"; playerId: string }[];
  sets: { sideAGames: number; sideBGames: number }[];
};

/**
 * Individual standings scoped to only matches played among a specific
 * subset of players (a custom group's members - see
 * createTournamentGroupAction), computed directly from the match list
 * rather than getTournamentStandings (which is tournament-wide and can't be
 * scoped) - a player's built-in group-stage results must not leak into a
 * custom "Додаткові групи" section meant to track its own separate bracket.
 */
function buildScopedSinglesRows(
  matches: CompletedMatchRow[],
  members: { playerId: string; player: { name: string } }[],
): { rows: StandingsRow[]; h2h: HeadToHead } {
  const memberIds = new Set(members.map((m) => m.playerId));
  const scopedMatches = matches.filter((m) => m.players.every((p) => memberIds.has(p.playerId)));

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

    const matchPoints = computeMatchPoints(match.sets);
    const gamesA = match.sets.reduce((sum, s) => sum + s.sideAGames, 0);
    const gamesB = match.sets.reduce((sum, s) => sum + s.sideBGames, 0);

    for (const p of match.players) {
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
      label: m.player.name,
      href: `/players/${m.playerId}`,
      matchesPlayed: s?.matchesPlayed ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      winPct: s && s.matchesPlayed > 0 ? Math.round((s.wins / s.matchesPlayed) * 100) : 0,
      gamesWon: s?.gamesWon ?? 0,
      gamesLost: s?.gamesLost ?? 0,
      points: s?.points ?? 0,
    };
  });
  return { rows, h2h };
}

type DoublesMatchRow = Awaited<ReturnType<typeof fetchDoublesMatches>>[number];

function fetchDoublesMatches(tournamentId: string) {
  return prisma.match.findMany({
    where: { tournamentId, matchType: "DOUBLES", status: { not: "CANCELLED" } },
    select: {
      status: true,
      winnerSide: true,
      players: { select: { side: true, playerId: true, player: { select: { name: true } } } },
      sets: { select: { sideAGames: true, sideBGames: true } },
    },
  });
}

/**
 * Doubles standings grouped by the exact pair of players who played each side
 * together. Teams show up as soon as they have a scheduled match (0-0), not
 * only once they've completed one - otherwise a freshly-drawn bracket with
 * no scores entered yet looks like an empty roster. Takes an already-fetched
 * match list (rather than fetching itself) so a custom group's section (see
 * getTournamentStandingsRows) can call this again with just its own matches
 * - a team's built-in group-stage result must not leak into a custom
 * "Додаткові групи" bracket's stats.
 */
function buildTeamRows(matches: DoublesMatchRow[]): { rows: StandingsRow[]; h2h: HeadToHead } {
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

export type StandingsGroup = {
  label: string;
  rows: StandingsRow[];
  roundRobinDone: boolean;
  /** The TournamentGroup's own id - only set for a custom "Додаткові групи" section (see createTournamentGroupAction), so the UI can offer a delete action there and nowhere else. */
  id?: string;
};

/** One way of splitting the same players into brackets - `title` is only shown when more than one grouping is active at once. */
export type StandingsGrouping = { title: string | null; groups: StandingsGroup[] };

export type PlacedStandingsRow = StandingsRow & { place: number | null };

/**
 * A single combined table ranked by an EXTERNALLY decided tournament place
 * (1-12), not by live win/loss counts - only ever attached for the
 * "GROUPS_12_PLAYOFF" randomizer (see docs/GROUPS12_PLAYOFF.md), detected
 * structurally by the presence of "Група за 9-12 місце" matches. `place` is
 * null for a row not yet decided (its bracket path isn't finished yet) -
 * `complete` is true once every row has one. Shown ALONGSIDE the built-in
 * "За групами" (A-D) breakdown below, not instead of it - the admin wants
 * to see both the per-group detail and the tournament-wide final result.
 */
export type PlacedTable = { rows: PlacedStandingsRow[]; complete: boolean };

export type TournamentStandingsResult =
  | { mode: "individual"; rows: StandingsRow[]; roundRobinDone: boolean; placedTable?: PlacedTable }
  | { mode: "grouped"; groupings: StandingsGrouping[]; placedTable?: PlacedTable };

function buildGroup(label: string, rows: StandingsRow[], h2h: HeadToHead, id?: string): StandingsGroup {
  const sorted = sortRows(rows, h2h);
  return { label, rows: sorted, roundRobinDone: isRoundRobinComplete(rows, h2h), id };
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
  // customGroups' `members` are a many-to-many overlay (TournamentGroupMember,
  // see createTournamentGroupAction) independent of participants[].group - a
  // player can be in their built-in 1-6 group *and* any number of these at
  // once, so they're rendered as their own separate groupings below rather
  // than merged into the built-in group split.
  const customGroups = await prisma.tournamentGroup.findMany({
    where: { tournamentId },
    select: { id: true, number: true, name: true, members: { select: { playerId: true } } },
  });
  // Legacy fallback only: a group number >6 could only end up on
  // participants[].group from before custom groups moved to their own
  // membership table - resolveGroupLabel still resolves it to the right
  // name for any tournament with that now-frozen leftover data.
  const customGroupNames = new Map(customGroups.map((g) => [g.number, g.name]));

  if (format === "DOUBLES") {
    const doublesMatches = await fetchDoublesMatches(tournamentId);
    const { rows, h2h } = buildTeamRows(doublesMatches);

    // A team's key is its two playerIds joined by "+" (see getTeamRows) - a
    // team belongs to an admin-assigned group only when both its players
    // share the same non-null group (the doubles "За групами" randomizer
    // only ever forms teams within one group, but a team could still exist
    // without ever going through it - e.g. a manually created match). A team
    // whose two players are in *different* non-null groups belongs to
    // neither - it's excluded from every bucket below, including "Без
    // групи" (which means "neither player has any group", not "ambiguous").
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

    // Union of groups that already have a played-together team AND groups an
    // admin has assigned individual participants to but who haven't played
    // as a pair yet (e.g. a group just created via "Додати групу" mid-
    // tournament) - both count toward "is this tournament meaningfully
    // split", and the latter still needs its own section (see below), just
    // with no team stats to show yet.
    const teamGroupIds = new Set(rows.map((r) => teamGroup(r.key)).filter((g): g is number => g != null));
    const participantGroupIds = new Set(
      participants.filter((p) => p.group != null).map((p) => p.group!),
    );
    const groupIds = [...new Set([...teamGroupIds, ...participantGroupIds])].sort((a, b) => a - b);
    const hasUngroupedRemainder = rows.some((r) => isUngroupedTeam(r.key));

    // Builds one group/bucket's section scoped to matches played strictly
    // among `memberIds` (all 4 players) - not by filtering the tournament-
    // wide team rows above, which would let a team's playoff/other-group
    // result leak into this bucket's stats just because they also share it.
    // Members not yet paired within that scope get a placeholder row (name
    // only, zeroed stats) instead of the section silently omitting them.
    const buildDoublesGroup = (label: string, memberIds: Set<string>, groupId?: string): StandingsGroup => {
      const scopedMatches = doublesMatches.filter((m) => m.players.every((p) => memberIds.has(p.playerId)));
      const { rows: teamRowsForGroup, h2h: groupH2h } = buildTeamRows(scopedMatches);
      const pairedPlayerIds = new Set(teamRowsForGroup.flatMap((r) => r.key.split("+")));
      const placeholderRows: StandingsRow[] = participants
        .filter((p) => memberIds.has(p.playerId) && !pairedPlayerIds.has(p.playerId))
        .map((p) => ({
          key: p.playerId,
          label: p.player.name,
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

    // A lone group covering every team isn't a meaningful split (same table
    // either way) - but one group alongside an ungrouped remainder is.
    if (groupIds.length + (hasUngroupedRemainder ? 1 : 0) >= 2) {
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

    // Custom groups (see createTournamentGroupAction) are an independent
    // many-to-many overlay - a team shows up here when both its players are
    // members of the same custom group, regardless of their built-in 1-6
    // group (a team can legally appear in both this section and "За
    // групами" above at once).
    const customGroupSections = customGroups
      .map((cg) => {
        const memberIds = new Set(cg.members.map((m) => m.playerId));
        if (memberIds.size === 0) return null;
        return buildDoublesGroup(cg.name, memberIds, cg.id);
      })
      .filter((g): g is StandingsGroup => g !== null);
    if (customGroupSections.length > 0) {
      groupings.push({ title: "Додаткові групи", groups: customGroupSections });
    }

    if (groupings.length === 1) groupings[0] = { ...groupings[0], title: null };
    if (groupings.length > 0) return { mode: "grouped", groupings };

    return {
      mode: "individual",
      rows: sortRows(rows, h2h),
      roundRobinDone: isRoundRobinComplete(rows, h2h),
    };
  }

  const { rows, h2h, matches } = await getIndividualRows(tournamentId, participants);

  const groups12Playoff = await buildGroups12PlayoffTable(tournamentId, rows, participants);
  const placedTable = groups12Playoff?.table;

  const groupIds = [...new Set(participants.filter((p) => p.group != null).map((p) => p.group!))].sort(
    (a, b) => a - b,
  );
  const hasUngroupedParticipant = participants.some((p) => p.group == null);
  const seededIds = new Set(participants.filter((p) => p.seed !== null).map((p) => p.playerId));
  // A lone group covering every participant isn't a meaningful split (same
  // table either way) - but one group alongside an ungrouped remainder is
  // (e.g. a group just created via "Додати групу" for some of the roster).
  const hasGroups = groupIds.length + (hasUngroupedParticipant ? 1 : 0) >= 2;
  // GROUPS_12_PLAYOFF only seeds one player per group (to spread them across
  // A-D) - that's not a meaningful Gold/Silver split the way a dedicated
  // "SEEDED_SPLIT" randomizer's seeding is, so skip this section for it.
  const hasSeeds = seededIds.size > 0 && !groups12Playoff;

  // Every group/bucket below (built-in group, "Без групи", Gold/Silver, and
  // custom groups) is scoped to matches played strictly among its own
  // members - not by filtering the tournament-wide rows above, which would
  // let a player's playoff/other-group result leak into a bucket's stats
  // just because they also happen to belong to it.
  const buildSinglesGroup = (
    label: string,
    members: { playerId: string; player: { name: string } }[],
    groupId?: string,
  ): StandingsGroup => {
    const scoped = buildScopedSinglesRows(matches, members);
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
        // The four 3rd-place group finishers' own mini round robin (see
        // docs/GROUPS12_PLAYOFF.md) - shown as a 5th group table alongside
        // A-D, not just folded into the combined placedTable below.
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

  // Custom groups (see createTournamentGroupAction) are an independent
  // many-to-many overlay - a participant shows up here regardless of their
  // built-in 1-6 group, so they can legally appear in both this section and
  // "За групами" above at once.
  const customGroupSections = customGroups
    .map((cg) => {
      const memberIds = new Set(cg.members.map((m) => m.playerId));
      if (memberIds.size === 0) return null;
      return buildSinglesGroup(cg.name, participants.filter((p) => memberIds.has(p.playerId)), cg.id);
    })
    .filter((g): g is StandingsGroup => g !== null);
  if (customGroupSections.length > 0) {
    groupings.push({ title: "Додаткові групи", groups: customGroupSections });
  }

  if (groupings.length === 0) {
    return {
      mode: "individual",
      rows: sortRows(rows, h2h),
      roundRobinDone: isRoundRobinComplete(rows, h2h),
      placedTable,
    };
  }
  if (groupings.length === 1) groupings[0] = { ...groupings[0], title: null };
  return { mode: "grouped", groupings, placedTable };
}

/**
 * The combined 1-12 table for the "GROUPS_12_PLAYOFF" randomizer (see
 * docs/GROUPS12_PLAYOFF.md) - null for every other SINGLES/MIXED tournament.
 * Detected structurally by the presence of "Група за 9-12 місце" matches
 * rather than a dedicated Tournament field, consistent with how this format
 * is entirely derived from Match.round elsewhere in the codebase; if an
 * admin manually deletes those 6 matches the tournament just falls back to
 * the normal individual/grouped display instead of erroring.
 *
 * Places 1-8 come from the tournament's real decisive playoff matches
 * (Фінал/За 3/5/7 місце) via the same resolveDecisivePlacements the Set Club
 * rating engine uses. Places 9-12 come from the mini-group's OWN standings,
 * scoped to just its 6 matches (buildScopedSinglesRows) rather than each
 * player's full tournament record - a 3rd-place group finisher's group-stage
 * wins against players outside the mini-group must not leak into this
 * placement, the same scoping principle already applied to every other
 * group table in this file. `rows`' own stats (matchesPlayed/wins/etc, from
 * the already-computed tournament-wide `individualRows`) are left as-is -
 * only their order and the new `place` field are placement-derived.
 *
 * Also returns `miniGroup`: the same 4-player mini round robin as its own
 * `StandingsGroup`, for display as a 5th table alongside the built-in A-D
 * groups (the admin wants both the per-group detail and the combined
 * result, not one instead of the other).
 */
async function buildGroups12PlayoffTable(
  tournamentId: string,
  individualRows: StandingsRow[],
  participants: { playerId: string; player: { id: string; name: string } }[],
): Promise<{ table: PlacedTable; miniGroup: StandingsGroup } | null> {
  const miniGroupMatches = await prisma.match.findMany({
    where: { tournamentId, round: MINI_GROUP_ROUND },
    select: {
      status: true,
      winnerSide: true,
      players: { select: { side: true, playerId: true } },
      sets: { select: { sideAGames: true, sideBGames: true } },
    },
  });
  if (miniGroupMatches.length === 0) return null;

  const decisiveMatches = await prisma.match.findMany({
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
  const { rows: miniRows, h2h: miniH2h } = buildScopedSinglesRows(completedMiniMatches, miniMembers);
  if (isRoundRobinComplete(miniRows, miniH2h)) {
    sortRows(miniRows, miniH2h).forEach((row, i) => placeByKey.set(row.key, 9 + i));
  }

  const rows: PlacedStandingsRow[] = individualRows
    .map((row) => ({ ...row, place: placeByKey.get(row.key) ?? null }))
    .sort((a, b) => {
      if (a.place == null && b.place == null) return a.label.localeCompare(b.label);
      if (a.place == null) return 1;
      if (b.place == null) return -1;
      return a.place - b.place;
    });

  const miniGroup = buildGroup(MINI_GROUP_ROUND, miniRows, miniH2h);

  return { table: { rows, complete: rows.every((r) => r.place != null) }, miniGroup };
}
