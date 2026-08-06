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
};

export type SnapshotAdvancement =
  | { matchId: string; side: Side; source: "GROUP_RANK"; sourceGroup: number; sourceRank: 1 | 2 | 3 }
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
  /** Every roster entry's built-in round-robin group (TournamentParticipant.group, 1-6) - null if ungrouped. */
  participants: { playerId: string; name: string; group: number | null }[];
};

export type DesiredFill = { matchId: string; side: Side; playerId: string | null };
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
    for (const winner of winners) {
      for (const loser of losers) recordHeadToHead(h2h, winner.playerId, loser.playerId);
    }

    const gamesA = match.sets.reduce((sum, s) => sum + s.sideAGames, 0);
    const gamesB = match.sets.reduce((sum, s) => sum + s.sideBGames, 0);
    for (const p of match.players) {
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
function groupRankPlayer(snapshot: TournamentBracketSnapshot, group: number, rank: 1 | 2 | 3): string | null {
  const { rows, h2h } = computeGroupStandings(snapshot, group);
  if (!isRoundRobinComplete(rows, h2h)) return null;
  return sortRows(rows, h2h)[rank - 1]?.key ?? null;
}

/** The winner/loser of `match`, or null until it's a decided COMPLETED match. */
function matchOutcomePlayer(match: SnapshotMatch | undefined, outcome: MatchOutcome): string | null {
  if (!match || match.status !== "COMPLETED" || match.winnerSide == null) return null;
  const side: Side = outcome === "WINNER" ? match.winnerSide : match.winnerSide === "A" ? "B" : "A";
  return match.players.find((p) => p.side === side)?.playerId ?? null;
}

function desiredPlayerFor(
  advancement: SnapshotAdvancement,
  snapshot: TournamentBracketSnapshot,
  matchById: Map<string, SnapshotMatch>,
): string | null {
  if (advancement.source === "GROUP_RANK") {
    return groupRankPlayer(snapshot, advancement.sourceGroup, advancement.sourceRank);
  }
  return matchOutcomePlayer(matchById.get(advancement.sourceMatchId), advancement.outcome);
}

/**
 * A completed match's own group, if both its players share one non-null
 * built-in `TournamentParticipant.group` - i.e. this is an actual
 * group-stage match, not a cross-group bracket match (a playoff match's two
 * players always come from *different* groups by construction, so this
 * naturally never fires for QF/SF/etc. matches).
 */
function ownGroupOf(match: SnapshotMatch, snapshot: TournamentBracketSnapshot): number | null {
  if (match.players.length !== 2) return null;
  const groupById = new Map(snapshot.participants.map((p) => [p.playerId, p.group]));
  const groups = new Set(match.players.map((p) => groupById.get(p.playerId) ?? null));
  if (groups.size !== 1) return null;
  const [group] = [...groups];
  return group ?? null;
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
      const desired = desiredPlayerFor(adv, snapshot, matchById);
      const target = matchById.get(adv.matchId);
      const current = target?.players.find((p) => p.side === adv.side)?.playerId ?? null;
      if (desired === current) continue;

      fills.push({ matchId: adv.matchId, side: adv.side, playerId: desired });
      if (!target) continue;

      target.players = target.players.filter((p) => p.side !== adv.side);
      if (desired) target.players.push({ side: adv.side, playerId: desired });

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
