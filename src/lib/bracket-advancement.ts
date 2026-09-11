import { isRoundRobinComplete, recordHeadToHead, sortRows } from "@/lib/standings-sort";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";

export type Side = "A" | "B";
export type MatchOutcome = "WINNER" | "LOSER";

export type SnapshotMatch = {
  id: string;
  round: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  winnerSide: Side | null;
  players: { side: Side; playerId: string }[];
  sets: { sideAGames: number; sideBGames: number }[];
  /** Technical loss from withdrawParticipantAction - see the schema comment on Match.walkover. */
  walkover: boolean;
};

export type SnapshotAdvancement =
  | { matchId: string; side: Side; source: "GROUP_RANK"; sourceGroup: number; sourceRank: number }
  | { matchId: string; side: Side; source: "MATCH_RESULT"; sourceMatchId: string; outcome: MatchOutcome };

/**
 * Read-only view of one tournament's bracket, assembled from `tx` inside
 * `saveScoreAction` (src/lib/actions/matches.ts) - must already reflect the
 * score change being saved (the just-edited match's players/status/
 * winnerSide/sets as they will be written), since propagation starts FROM
 * that state rather than deciding for itself what changed.
 */
export type TournamentBracketSnapshot = {
  matches: SnapshotMatch[];
  advancements: SnapshotAdvancement[];
  /**
   * Whether a GROUP_RANK slot resolves to one player (SINGLES) or a pair
   * (DOUBLES, see docs/DOUBLES_GROUP_PLAYOFF.md) - a tournament is always
   * one format, so this is simpler and more robust than inferring team size
   * from however many of a group's matches happen to be COMPLETED so far.
   */
  format: "SINGLES" | "DOUBLES";
  /** Every roster entry's built-in round-robin group (TournamentParticipant.group, 1-6) - null if ungrouped. */
  participants: {
    playerId: string;
    name: string;
    group: number | null;
    /** Set once an admin withdraws this player (see withdrawParticipantAction) - excludes them from groupRankTeam's rank candidates below. */
    withdrawnAt: string | null;
  }[];
};

/** `playerIds` is 1 player for a SINGLES slot, 2 (a team) for DOUBLES - empty means "not decided yet / just unfilled". */
export type DesiredFill = { matchId: string; side: Side; playerIds: string[] };
export type PendingReset = { matchId: string; round: string | null };
export type AdvancementPropagation = { fills: DesiredFill[]; resets: PendingReset[] };

function computeGroupStandings(
  snapshot: TournamentBracketSnapshot,
  group: number,
): { rows: StandingsRow[]; h2h: HeadToHead } {
  const members = snapshot.participants.filter((p) => p.group === group);
  const memberIds = new Set(members.map((m) => m.playerId));
  const scopedMatches = snapshot.matches.filter(
    (m) =>
      m.status === "COMPLETED" &&
      m.winnerSide != null &&
      m.players.length === 2 &&
      m.players.every((p) => memberIds.has(p.playerId)),
  );

  const h2h: HeadToHead = new Map();
  const stats = new Map<
    string,
    { matchesPlayed: number; wins: number; losses: number; gamesWon: number; gamesLost: number }
  >();

  for (const match of scopedMatches) {
    const winners = match.players.filter((p) => p.side === match.winnerSide);
    const losers = match.players.filter((p) => p.side !== match.winnerSide);
    // Recorded for both sides even for a walkover, same as
    // tournament-standings.ts - isRoundRobinComplete below needs every pair
    // decided to let this group's advancement resolve (see
    // docs/WITHDRAWAL.md).
    for (const winner of winners) {
      for (const loser of losers) recordHeadToHead(h2h, winner.playerId, loser.playerId);
    }

    const gamesA = match.sets.reduce((sum, s) => sum + s.sideAGames, 0);
    const gamesB = match.sets.reduce((sum, s) => sum + s.sideBGames, 0);
    for (const p of match.players) {
      // The withdrawn side of a walkover never played it - no
      // matchesPlayed/loss for them, only the winner's side is credited.
      if (match.walkover && p.side !== match.winnerSide) continue;

      const entry = stats.get(p.playerId) ?? {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
      };
      entry.matchesPlayed += 1;
      if (p.side === match.winnerSide) entry.wins += 1;
      else entry.losses += 1;
      entry.gamesWon += p.side === "A" ? gamesA : gamesB;
      entry.gamesLost += p.side === "A" ? gamesB : gamesA;
      stats.set(p.playerId, entry);
    }
  }

  const rows: StandingsRow[] = members.map((m) => {
    const s = stats.get(m.playerId);
    return {
      key: m.playerId,
      label: m.name,
      matchesPlayed: s?.matchesPlayed ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      winPct: s && s.matchesPlayed > 0 ? Math.round((s.wins / s.matchesPlayed) * 100) : 0,
      gamesWon: s?.gamesWon ?? 0,
      gamesLost: s?.gamesLost ?? 0,
      points: 0, // unused by sortRows/isRoundRobinComplete - not worth computing here
    };
  });
  return { rows, h2h };
}

/** The player currently ranked `rank` (1-based) in `group`, or null until that group's round robin is fully played out. */
function groupRankPlayer(snapshot: TournamentBracketSnapshot, group: number, rank: number): string | null {
  const { rows, h2h } = computeGroupStandings(snapshot, group);
  if (!isRoundRobinComplete(rows, h2h)) return null;
  // Withdrawn players stay in `rows` (their opponents still need correct
  // matchesPlayed/h2h against them, computed above), but can never be the
  // one who advances - skip them only at the point of picking rank N, same
  // "no walkover-fabricated bracket seat" rule as docs/WITHDRAWAL.md.
  const withdrawnIds = new Set(
    snapshot.participants.filter((p) => p.withdrawnAt != null).map((p) => p.playerId),
  );
  const eligible = sortRows(rows, h2h).filter((row) => !withdrawnIds.has(row.key));
  return eligible[rank - 1]?.key ?? null;
}

/**
 * DOUBLES twin of computeGroupStandings: rows are keyed by TEAM (both
 * playerIds sorted and joined by "+", same convention buildTeamRows/teamGroup
 * use in tournament-standings.ts), scoped to this built-in group's own
 * round-robin matches - a group-stage doubles match always has exactly 4
 * players, all members of the same group by construction (the "За групами"
 * randomizer never crosses a team over a group boundary).
 */
function computeDoublesGroupStandings(
  snapshot: TournamentBracketSnapshot,
  group: number,
): { rows: StandingsRow[]; h2h: HeadToHead; teamsByMemberPlayerId: Map<string, string> } {
  const members = snapshot.participants.filter((p) => p.group === group);
  const memberIds = new Set(members.map((m) => m.playerId));
  // Every one of the group's own round-robin matches (any non-CANCELLED
  // status, not just COMPLETED) - team membership is fixed the moment those
  // matches are created (see commitDoublesGroupsAction), same as how a
  // player's TournamentParticipant.group is already fixed before any group
  // match is played. Scoping the team ROSTER to only COMPLETED matches (as
  // opposed to the stats loop below, which correctly does) would make a team
  // with zero results so far invisible instead of showing as 0-0 - the
  // doubles counterpart of computeGroupStandings unconditionally listing
  // every `members` row regardless of whether they've played yet.
  const groupMatches = snapshot.matches.filter(
    (m) => m.status !== "CANCELLED" && m.players.length === 4 && m.players.every((p) => memberIds.has(p.playerId)),
  );

  const teamKey = (playerIds: string[]) => [...playerIds].sort().join("+");
  const nameById = new Map(snapshot.participants.map((p) => [p.playerId, p.name]));
  const teamLabel = (playerIds: string[]) =>
    [...playerIds].map((id) => nameById.get(id) ?? "?").join(" / ");

  const teamsByMemberPlayerId = new Map<string, string>();
  const teamKeys = new Set<string>();
  for (const match of groupMatches) {
    for (const side of ["A", "B"] as const) {
      const teamIds = match.players.filter((p) => p.side === side).map((p) => p.playerId);
      const key = teamKey(teamIds);
      teamKeys.add(key);
      for (const id of teamIds) teamsByMemberPlayerId.set(id, key);
    }
  }

  const h2h: HeadToHead = new Map();
  const stats = new Map<
    string,
    { matchesPlayed: number; wins: number; losses: number; gamesWon: number; gamesLost: number }
  >();

  for (const match of groupMatches) {
    if (match.status !== "COMPLETED" || match.winnerSide == null) continue;

    const keyA = teamKey(match.players.filter((p) => p.side === "A").map((p) => p.playerId));
    const keyB = teamKey(match.players.filter((p) => p.side === "B").map((p) => p.playerId));
    const winnerKey = match.winnerSide === "A" ? keyA : keyB;
    const loserKey = match.winnerSide === "A" ? keyB : keyA;
    // Same walkover-still-counts-toward-h2h reasoning as computeGroupStandings.
    recordHeadToHead(h2h, winnerKey, loserKey);

    const gamesA = match.sets.reduce((sum, s) => sum + s.sideAGames, 0);
    const gamesB = match.sets.reduce((sum, s) => sum + s.sideBGames, 0);
    for (const [side, key] of [
      ["A", keyA],
      ["B", keyB],
    ] as const) {
      // The withdrawn side of a walkover never played it.
      if (match.walkover && side !== match.winnerSide) continue;

      const entry = stats.get(key) ?? { matchesPlayed: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0 };
      entry.matchesPlayed += 1;
      if (side === match.winnerSide) entry.wins += 1;
      else entry.losses += 1;
      entry.gamesWon += side === "A" ? gamesA : gamesB;
      entry.gamesLost += side === "A" ? gamesB : gamesA;
      stats.set(key, entry);
    }
  }

  const rows: StandingsRow[] = [...teamKeys].map((key) => {
    const s = stats.get(key);
    return {
      key,
      label: teamLabel(key.split("+")),
      matchesPlayed: s?.matchesPlayed ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      winPct: s && s.matchesPlayed > 0 ? Math.round((s.wins / s.matchesPlayed) * 100) : 0,
      gamesWon: s?.gamesWon ?? 0,
      gamesLost: s?.gamesLost ?? 0,
      points: 0, // unused by sortRows/isRoundRobinComplete
    };
  });
  return { rows, h2h, teamsByMemberPlayerId };
}

/**
 * The team currently ranked `rank` (1-based) in `group`, or null until that
 * group's round robin is fully played out - SINGLES/DOUBLES twin of
 * groupRankPlayer, returning every player of the resolved team (1 for
 * SINGLES, 2 for DOUBLES).
 */
function groupRankTeam(snapshot: TournamentBracketSnapshot, group: number, rank: number): string[] | null {
  if (snapshot.format === "SINGLES") {
    const player = groupRankPlayer(snapshot, group, rank);
    return player ? [player] : null;
  }

  const { rows, h2h, teamsByMemberPlayerId } = computeDoublesGroupStandings(snapshot, group);
  const members = snapshot.participants.filter((p) => p.group === group);
  // Complete once every member who's actually paired into a team this group
  // has played (isRoundRobinComplete on team rows) AND nobody in the group
  // is still unpaired - mirrors buildRandomDoublesPairing's own "everyone or
  // nobody" pairing within a group (see randomize-pairs.ts).
  if (!isRoundRobinComplete(rows, h2h)) return null;
  if (members.some((m) => !teamsByMemberPlayerId.has(m.playerId))) return null;

  const withdrawnTeamKeys = new Set(
    snapshot.participants
      .filter((p) => p.withdrawnAt != null)
      .map((p) => teamsByMemberPlayerId.get(p.playerId))
      .filter((key): key is string => key != null),
  );
  const eligible = sortRows(rows, h2h).filter((row) => !withdrawnTeamKeys.has(row.key));
  const team = eligible[rank - 1];
  return team ? team.key.split("+") : null;
}

/** All players of the winning/losing side of `match`, or null until it's a decided COMPLETED match. */
function matchOutcomeTeam(match: SnapshotMatch | undefined, outcome: MatchOutcome): string[] | null {
  if (!match || match.status !== "COMPLETED" || match.winnerSide == null) return null;
  const side: Side = outcome === "WINNER" ? match.winnerSide : match.winnerSide === "A" ? "B" : "A";
  const playerIds = match.players.filter((p) => p.side === side).map((p) => p.playerId);
  return playerIds.length > 0 ? playerIds : null;
}

function desiredTeamFor(
  advancement: SnapshotAdvancement,
  snapshot: TournamentBracketSnapshot,
  matchById: Map<string, SnapshotMatch>,
): string[] | null {
  if (advancement.source === "GROUP_RANK") {
    return groupRankTeam(snapshot, advancement.sourceGroup, advancement.sourceRank);
  }
  return matchOutcomeTeam(matchById.get(advancement.sourceMatchId), advancement.outcome);
}

/**
 * A completed match's own group, if every one of its players shares one
 * non-null built-in `TournamentParticipant.group` - i.e. this is an actual
 * group-stage match, not a cross-group bracket match (a playoff match's
 * players always come from *different* groups by construction, so this
 * naturally never fires for SF/Final/etc. matches). Expects exactly 2
 * players for SINGLES, 4 (2 per side) for DOUBLES.
 */
function ownGroupOf(match: SnapshotMatch, snapshot: TournamentBracketSnapshot): number | null {
  const expectedPlayerCount = snapshot.format === "DOUBLES" ? 4 : 2;
  if (match.players.length !== expectedPlayerCount) return null;
  const groupById = new Map(snapshot.participants.map((p) => [p.playerId, p.group]));
  const groups = new Set(match.players.map((p) => groupById.get(p.playerId) ?? null));
  if (groups.size !== 1) return null;
  const [group] = [...groups];
  return group ?? null;
}

/**
 * Human-readable label for one side of a match - joins every player's name
 * with " / " (1 name for SINGLES, 2 for DOUBLES). Used by saveScoreAction/
 * deleteMatchAction/withdrawParticipantAction (and their Padel twins) to
 * describe a cascade-reset match in the confirmation prompt.
 */
export function sideTeamLabel(
  match: SnapshotMatch | undefined,
  side: Side,
  nameById: Map<string, string>,
): string {
  const players = match?.players.filter((p) => p.side === side) ?? [];
  if (players.length === 0) return "?";
  return players.map((p) => nameById.get(p.playerId) ?? "?").join(" / ");
}

/** Order-independent equality for two playerId lists (a 1- or 2-element team). */
function sameTeam(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

/**
 * Propagates the effect of `changedMatchId`'s current (already-applied)
 * result outward through the bracket: fills every downstream slot whose
 * source just became decided, and - the same traversal, since "desired"
 * is always recomputed fresh rather than diffed against what changed -
 * cascade-resets any downstream match whose now-stale COMPLETED result
 * depended on the old value. Idempotent: re-running with no actual change
 * anywhere produces empty fills/resets.
 */
export function computeAdvancementPropagation(
  snapshot: TournamentBracketSnapshot,
  changedMatchId: string,
): AdvancementPropagation {
  const matchById = new Map(
    snapshot.matches.map((m) => [m.id, { ...m, players: [...m.players], sets: [...m.sets] }]),
  );

  const advancementsBySourceMatchId = new Map<string, SnapshotAdvancement[]>();
  const advancementsByGroup = new Map<number, SnapshotAdvancement[]>();
  for (const adv of snapshot.advancements) {
    if (adv.source === "MATCH_RESULT") {
      const list = advancementsBySourceMatchId.get(adv.sourceMatchId);
      if (list) list.push(adv);
      else advancementsBySourceMatchId.set(adv.sourceMatchId, [adv]);
    } else {
      const list = advancementsByGroup.get(adv.sourceGroup);
      if (list) list.push(adv);
      else advancementsByGroup.set(adv.sourceGroup, [adv]);
    }
  }

  const fills: DesiredFill[] = [];
  const resets: PendingReset[] = [];
  const visited = new Set<string>();
  const queue: string[] = [changedMatchId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const affected: SnapshotAdvancement[] = [...(advancementsBySourceMatchId.get(currentId) ?? [])];
    const currentMatch = matchById.get(currentId);
    if (currentMatch) {
      const group = ownGroupOf(currentMatch, snapshot);
      if (group != null) affected.push(...(advancementsByGroup.get(group) ?? []));
    }

    for (const adv of affected) {
      const desired = desiredTeamFor(adv, snapshot, matchById) ?? [];
      const target = matchById.get(adv.matchId);
      const current = target?.players.filter((p) => p.side === adv.side).map((p) => p.playerId) ?? [];
      if (sameTeam(desired, current)) continue;

      fills.push({ matchId: adv.matchId, side: adv.side, playerIds: desired });
      if (!target) continue;

      target.players = target.players.filter((p) => p.side !== adv.side);
      for (const playerId of desired) target.players.push({ side: adv.side, playerId });

      if (target.status === "COMPLETED") {
        resets.push({ matchId: target.id, round: target.round });
        target.status = "SCHEDULED";
        target.winnerSide = null;
        target.sets = [];
      }
      if (!visited.has(target.id)) queue.push(target.id);
    }
  }

  return { fills, resets };
}
