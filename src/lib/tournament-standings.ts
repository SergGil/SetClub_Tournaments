import { prisma } from "@/lib/db";
import { computeMatchPoints } from "@/lib/match-result";
import { displayName } from "@/lib/player-display";
import { FINAL_ROUND, isPlayoffRound, MINI_GROUP_ROUND } from "@/lib/playoff-rounds";
import { resolveGroupLabel } from "@/lib/randomize-pairs";
import type { PlayoffResult } from "@/lib/rating/placement";
import { PLACEMENT_ROUND_RANKS, resolveDecisivePlacements } from "@/lib/rating/placement";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { isRoundRobinComplete, recordHeadToHead, sortRows } from "@/lib/standings-sort";
import { getTournamentStandings } from "@/lib/stats";
import type { TournamentFormat } from "@/lib/validation/tournament";

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
    getTournamentStandings(tournamentId),
    prisma.match.findMany({
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
    // A walkover has no sets to score from, and a retired match's recorded
    // sets don't have to agree with who's actually the winner - both get
    // the flat 2-0 split off winnerSide instead (see computeMatchPoints's
    // doc comment).
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

/**
 * Individual standings scoped to only matches played among a specific
 * subset of players (a custom group's members - see
 * createTournamentGroupAction), computed directly from the match list
 * rather than getTournamentStandings (which is tournament-wide and can't be
 * scoped) - a player's built-in group-stage results must not leak into a
 * custom "Додаткові групи" section meant to track its own separate bracket.
 *
 * `roundFilter`, when given, additionally requires `match.round` to equal it
 * exactly - required for a custom group (its members can easily all also
 * share a *different* group/bracket together, e.g. two players from the same
 * built-in "Група B" both later added to a "За 7 місце" custom group; without
 * this, their old Група B match - both its players happen to be members of
 * the new group too - would otherwise count toward "За 7 місце" even though
 * nobody has played a "За 7 місце" match between them yet).
 *
 * Left undefined for the built-in group/Gold-Silver/"Без групи" sections,
 * which have no single round label to anchor to (a manually created match's
 * round is free text, not guaranteed to match resolveGroupLabel's output) -
 * those instead fall back to `otherRoundNames`: still permissive of a
 * match with no round set (or free text that isn't a recognized round) so a
 * manually added group-stage match keeps counting, but excludes one whose
 * round is clearly a DIFFERENT recognized context - a curated playoff round
 * (`isPlayoffRound`) or another custom group's own name - the same class of
 * leak `roundFilter` closes for a custom group, just denylist-shaped since
 * there's no single expected value to require here (e.g. two "Група B"
 * members who later also meet in "Втішний півфінал" or a "За 7-10 місце"
 * custom bracket - that match must not inflate their Група B tally too).
 */
function buildScopedSinglesRows(
  matches: CompletedMatchRow[],
  members: { playerId: string; seed: number | null; player: { name: string; nickname?: string | null } }[],
  roundFilter?: string,
  otherRoundNames?: Set<string>,
  /**
   * Used by buildGeneralPlacedTable's merged leftover ranking, which wants
   * every real result between two still-unplaced players counted - including
   * a curated playoff-round rematch - rather than the round allowlist/
   * denylist below, which exists only to keep a *group's own* section from
   * leaking a foreign round's result into its stats.
   */
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
    // Recorded for both sides even for a walkover - see the same comment in
    // getIndividualRows above (docs/WITHDRAWAL.md).
    for (const winner of winners) {
      for (const loser of losers) recordHeadToHead(h2h, winner.playerId, loser.playerId);
    }

    // See getIndividualRows above.
    const matchPoints = computeMatchPoints(match.sets, match.winnerSide, match.retired);
    const gamesA = match.sets.reduce((sum, s) => sum + s.sideAGames, 0);
    const gamesB = match.sets.reduce((sum, s) => sum + s.sideBGames, 0);

    for (const p of match.players) {
      // The withdrawn side of a walkover never played it - no matchesPlayed/
      // loss/points for them, only the winner's side is credited below.
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
  return prisma.match.findMany({
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
  /** The TournamentGroup's own id - only set for a custom "Додаткові групи" section (see createTournamentGroupAction), so the UI can offer a delete action there and nowhere else. */
  id?: string;
};

/** One way of splitting the same players into brackets - `title` is only shown when more than one grouping is active at once. */
export type StandingsGrouping = { title: string | null; groups: StandingsGroup[] };

export type PlacedStandingsRow = StandingsRow & { place: number | null };

/**
 * A single combined table ranked by an EXTERNALLY decided tournament place,
 * not by live win/loss counts - attached either for the "GROUPS_12_PLAYOFF"
 * randomizer's fixed 1-12 bracket (see docs/GROUPS12_PLAYOFF.md, detected
 * structurally by the presence of "Група за 9-12 місце" matches) or, more
 * generally, for any SINGLES/MIXED tournament with its own real decisive
 * placement matches (buildGeneralPlacedTable) - see
 * TournamentStandingsResult's `formatRulesKind` for telling the two apart.
 * `place` is null for a row not yet decided (its bracket path isn't
 * finished yet) - `complete` is true once every row has one. Shown
 * ALONGSIDE the built-in "За групами" breakdown below, not instead of it -
 * the admin wants to see both the per-group detail and the tournament-wide
 * final result.
 */
export type PlacedTable = { rows: PlacedStandingsRow[]; complete: boolean };

/**
 * Which randomizer-shaped format (if any) actually produced this
 * tournament's current structure - used to pick the right explanation in
 * FormatRulesButton (src/components/format-rules-info.tsx), rather than a
 * single button hardcoded to one format's rules. Undefined when the
 * standings need no such explanation (a plain "усі проти всіх" round robin
 * is self-evident from the table alone). Detected structurally from the
 * same signals `getTournamentStandingsRows` already computes for its own
 * grouping decisions (built-in `group`, `seed`, and the GROUPS_12_PLAYOFF
 * mini-group's own detection) - not a stored Tournament field, so it stays
 * accurate even if an admin adjusts the roster by hand after randomizing.
 */
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
    /** See buildGroups12PlayoffTable's use of this - a withdrawn participant is excluded from the GROUPS_12_PLAYOFF combined table's completeness check, since their own mini-group slot (see docs/GROUPS12_PLAYOFF.md) never gets filled and would otherwise leave `complete` permanently false. */
    withdrawnAt?: Date | string | null;
    player: { id: string; name: string; nickname?: string | null };
  }[],
): Promise<TournamentStandingsResult> {
  // customGroups' `members` are a many-to-many overlay (TournamentGroupMember,
  // see createTournamentGroupAction) independent of participants[].group - a
  // player can be in their built-in 1-6 group *and* any number of these at
  // once, so they're rendered as their own separate groupings below rather
  // than merged into the built-in group split.
  const customGroups = await prisma.tournamentGroup.findMany({
    where: { tournamentId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, name: true, members: { select: { playerId: true } } },
  });
  // Legacy fallback only: a group number >6 could only end up on
  // participants[].group from before custom groups moved to their own
  // membership table - resolveGroupLabel still resolves it to the right
  // name for any tournament with that now-frozen leftover data.
  const customGroupNames = new Map(customGroups.map((g) => [g.number, g.name]));
  // Used by buildScopedSinglesRows/buildDoublesGroup's "no explicit
  // roundFilter" fallback (built-in group/Gold-Silver/"Без групи") to
  // recognize a match whose round is actually a *different* custom group's
  // own - see buildScopedSinglesRows's doc comment.
  const customGroupNameSet = new Set(customGroups.map((g) => g.name));

  if (format === "DOUBLES") {
    const doublesMatches = await fetchDoublesMatches(tournamentId);
    const { rows } = buildTeamRows(doublesMatches);

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
    // `roundFilter` - see buildScopedSinglesRows's doc comment; same reason,
    // required for a custom group so an old built-in-group match between two
    // players who are now also custom-group members doesn't leak in.
    const buildDoublesGroup = (
      label: string,
      memberIds: Set<string>,
      groupId?: string,
      roundFilter?: string,
    ): StandingsGroup => {
      // Same allowlist-when-known/denylist-when-not split as
      // buildScopedSinglesRows: an explicit roundFilter (custom group) is
      // required exactly; otherwise (built-in group/"Без групи") still
      // permissive of no-round/free-text matches, but excludes one whose
      // round is clearly a different curated playoff round or another
      // custom group's own name.
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

    // A lone group covering every team isn't a meaningful split (same table
    // either way) - but one group alongside an ungrouped remainder is.
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

    // Custom groups (see createTournamentGroupAction) are an independent
    // many-to-many overlay - a team shows up here when both its players are
    // members of the same custom group, regardless of their built-in 1-6
    // group (a team can legally appear in both this section and "За
    // групами" above at once). Shown even with zero members (a group with
    // no roster yet, created just to give matches a round to pick - see
    // create-match-dialog.tsx's "Додаткові групи" Раунд options) rather than
    // hidden until someone's added, same as the singles branch below.
    const customGroupSections = customGroups.map((cg) => {
      const memberIds = new Set(cg.members.map((m) => m.playerId));
      return buildDoublesGroup(cg.name, memberIds, cg.id, cg.name);
    });
    if (customGroupSections.length > 0) {
      groupings.push({ title: "Додаткові групи", groups: customGroupSections });
    }

    if (groupings.length === 1) groupings[0] = { ...groupings[0], title: null };
    // GROUPS_12_PLAYOFF/SEEDED_SPLIT are SINGLES-only randomizers - never
    // applicable here; "Додаткові групи" alone (no built-in groups) is
    // free-form admin structure, not a randomizer format, so it gets no
    // FormatRulesButton explanation either.
    const formatRulesKind = hasBuiltInGroups ? "CUSTOM_GROUPS" : undefined;
    // rows above are tournament-wide (playoff included) - right for
    // placedTable (a final overall record), but a "Підсумкова таблиця"
    // only exists once there's at least one real decisive playoff match.
    const placedTable = buildGeneralPlacedTableForTeams(doublesMatches, rows) ?? undefined;
    if (groupings.length > 0) return { mode: "grouped", groupings, placedTable, formatRulesKind };

    // Scoped to just the group-stage matches (excludes Фінал/За 3 місце/etc)
    // - same reason the SINGLES/MIXED branch below recomputes its own
    // groupStage instead of reusing the tournament-wide rows/h2h: this plain
    // table is shown ABOVE "Підсумкова таблиця" as the pre-playoff
    // standings, so a team that went on to play a playoff match shouldn't
    // show more played matches than one that didn't.
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
  // The GROUPS_12_PLAYOFF-specific table (with its own precise 9-12
  // mini-group placement) takes priority when detected; otherwise fall back
  // to the general one, for any other tournament that has manually created
  // placement matches (Фінал/За 3/5/7/9/11 місце) of its own.
  const placedTable = groups12Playoff?.table ?? buildGeneralPlacedTable(matches, rows, participants) ?? undefined;

  const groupIds = [...new Set(participants.filter((p) => p.group != null).map((p) => p.group!))].sort(
    (a, b) => a - b,
  );
  const hasUngroupedParticipant = participants.some((p) => p.group == null);
  const seededIds = new Set(participants.filter((p) => p.seed !== null).map((p) => p.playerId));
  // A lone group covering every participant isn't a meaningful split (same
  // table either way) - but one group alongside an ungrouped remainder is
  // (e.g. a group just created via "Додати групу" for some of the roster).
  const hasGroups = groupIds.length + (hasUngroupedParticipant ? 1 : 0) >= 2;
  // GROUPS_12_PLAYOFF seeds exactly one player per group (to spread them
  // across A-D via buildGroups12PlayoffDraw) - not a meaningful Gold/Silver
  // split the way a dedicated "SEEDED_SPLIT" randomizer's seeding is (every
  // seed would end up alone in its own group, having played none of the
  // other seeds). The plain "За групами" draw doesn't use `seed` to anchor
  // groups at all (assignUngroupedToGroups only reads the already-assigned
  // `group` field) - but whenever a tournament has both a meaningful group
  // split AND seeds set (whatever they're for - e.g. just the seed-first-
  // in-an-empty-group ordering from sortRows, not a deliberate Gold/Silver
  // split), showing a second, redundant seeded breakdown of the same
  // players next to "За групами" reads as noise rather than a second real
  // grouping - so skip it whenever groups are the active split instead.
  const hasSeeds = seededIds.size > 0 && !groups12Playoff && !hasGroups;

  // Every group/bucket below (built-in group, "Без групи", Gold/Silver, and
  // custom groups) is scoped to matches played strictly among its own
  // members - not by filtering the tournament-wide rows above, which would
  // let a player's playoff/other-group result leak into a bucket's stats
  // just because they also happen to belong to it.
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
  // "За групами" above at once. Shown even with zero members (a group with
  // no roster yet, created just to give matches a round to pick - see
  // create-match-dialog.tsx's "Додаткові групи" Раунд options) rather than
  // hidden until someone's added.
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

  // Priority mirrors hasSeeds' own precedence above: GROUPS_12_PLAYOFF (its
  // own hasGroups-shaped "За групами" section is really its bracket, not a
  // plain custom-groups draw) beats a genuine "За групами" split, which
  // beats "За сіяністю" (the two are already mutually exclusive by
  // construction, but GROUPS_12_PLAYOFF can co-occur with hasGroups).
  const formatRulesKind: FormatRulesKind | undefined = groups12Playoff
    ? "GROUPS_12_PLAYOFF"
    : hasGroups
      ? "CUSTOM_GROUPS"
      : hasSeeds
        ? "SEEDED_SPLIT"
        : undefined;
  if (groupings.length === 0) {
    // Scoped to just the group-stage matches (excludes Фінал/За 3 місце/etc)
    // - `rows`/`h2h` above are tournament-wide (playoff included), which is
    // right for `placedTable` (a final overall record) but wrong here: this
    // plain table is shown ABOVE "Підсумкова таблиця" as the pre-playoff
    // standings, so a player who then went on to play a playoff match
    // shouldn't show more played matches than one who didn't.
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

/**
 * Doubles counterpart of buildGeneralPlacedTable below - a "Підсумкова
 * таблиця" for any DOUBLES tournament with at least one real decisive
 * playoff match (Фінал/За 3/5/7/9/11 місце). A "team" here is exactly the
 * pair that played together on one side of that match, keyed the same way
 * buildTeamRows keys every other team row (both playerIds sorted and joined
 * by "+") - resolveDecisivePlacements needs no changes for this, since it's
 * already generic over string keys, not specifically playerIds.
 *
 * Every team the playoff bracket never covered is ranked together in one
 * pass, by the same criteria sortRows already uses everywhere else (wins,
 * win %, head-to-head, games differential, name) - including across
 * different groups, even though two such teams typically never played each
 * other at all. That's fine: compareHeadToHead already returns a neutral 0
 * when there's no recorded result between two rows, so the comparison just
 * falls through to games differential and then name instead of blocking -
 * there's no round-robin-completeness gate here anymore. `h2h` is built from
 * the FULL match list (not scoped per group), and deliberately includes
 * playoff-round matches too - a curated rematch between two otherwise-
 * unplaced teams is still a real result worth using.
 */
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
  if (playoffResults.length === 0) return null;

  const placeByKey = resolveDecisivePlacements(playoffResults);

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

/** Undecided rows (`place: null`) sort after every decided one, alphabetically among themselves. */
function sortByPlace(rows: PlacedStandingsRow[]): PlacedStandingsRow[] {
  return [...rows].sort((a, b) => {
    if (a.place == null && b.place == null) return a.label.localeCompare(b.label);
    if (a.place == null) return 1;
    if (b.place == null) return -1;
    return a.place - b.place;
  });
}

/**
 * A "Підсумкова таблиця" for any SINGLES/MIXED tournament that has at least
 * one real decisive playoff match (Фінал/За 3/5/7/9/11 місце -
 * PLACEMENT_ROUND_RANKS) - the general counterpart to
 * buildGroups12PlayoffTable, for a tournament organized by hand (built-in
 * groups + manually created placement matches, e.g. a "Група за 7-10 місце"
 * custom bracket) rather than through that specific 12-player randomizer.
 * Only resolveDecisivePlacements is used for the decisive matches
 * themselves, not the fuller resolvePlacements' round-robin fallback the
 * rating engine uses internally for Set Club points.
 *
 * Every player the decisive matches never covered is ranked together in one
 * pass, by the same criteria sortRows already uses everywhere else (wins,
 * win %, head-to-head, games differential, name) - including two players
 * from entirely different built-in groups or custom brackets who never
 * played each other at all. That's fine: compareHeadToHead already returns
 * a neutral 0 when there's no recorded result between two rows, so the
 * comparison just falls through to games differential and then name instead
 * of blocking - there's no round-robin-completeness gate here. Stats for
 * this ranking are recomputed directly from the raw match list
 * (buildScopedSinglesRows with includeAllRounds) rather than taken from
 * `individualRows`, so a curated playoff-round rematch between two
 * otherwise-unplaced players still counts as a real result. A withdrawn
 * participant is excluded from this pass entirely (never gets a `place`,
 * shown as "—") rather than being compared against active players.
 */
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
  if (playoffResults.length === 0) return null;

  const placeByKey = resolveDecisivePlacements(playoffResults);

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
  participants: {
    playerId: string;
    seed: number | null;
    withdrawnAt?: Date | string | null;
    player: { id: string; name: string; nickname?: string | null };
  }[],
): Promise<{ table: PlacedTable; miniGroup: StandingsGroup } | null> {
  const miniGroupMatches = await prisma.match.findMany({
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
  // Explicit roundFilter (redundant with the DB query above already scoping
  // miniGroupMatches to round: MINI_GROUP_ROUND, but MINI_GROUP_ROUND is
  // itself one of PLAYOFF_ROUNDS - without this, buildScopedSinglesRows'
  // "no explicit roundFilter" denylist fallback would incorrectly treat
  // every one of these matches as foreign and exclude them all).
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

  // A withdrawn participant who was their group's 3rd-place finisher never
  // gets a mini-group slot (groupRankPlayer permanently excludes them from
  // rank candidates - see bracket-advancement.ts), so their own row here
  // never receives a `place`. Without this exclusion, `complete` would stay
  // false forever for any tournament with such a withdrawal, even once every
  // *fillable* slot (including the mini round robin among the three
  // remaining 3rd-place finishers) is fully decided - see
  // docs/GROUPS12_PLAYOFF.md's "Відомі обмеження".
  const withdrawnIds = new Set(
    participants.filter((p) => p.withdrawnAt != null).map((p) => p.playerId),
  );
  const complete = rows.every((r) => r.place != null || withdrawnIds.has(r.key));

  return { table: { rows, complete }, miniGroup };
}
