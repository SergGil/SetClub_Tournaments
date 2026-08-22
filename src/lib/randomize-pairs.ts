export type ParticipantInput = { playerId: string; seeded: boolean };
export type Team = { playerIds: [string, string] };
export type TeamMatchup = { sideA: Team; sideB: Team };

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Draws random doubles teams from two baskets (seeded / unseeded), pairing one
 * player from each basket per team so strong players don't stack together.
 * Leftovers (when the baskets are uneven) are paired among themselves. Every
 * team then plays every other team once (round robin). Anyone who can't be
 * teamed (an odd total) comes back in `unpaired`.
 *
 * `fixedTeams` lets the admin lock in one or a few pairs ahead of the draw
 * (e.g. two players who specifically want to play together) - those players
 * are pulled out of the seeded/unseeded pools before the random pairing runs,
 * and their team is added back in as-is before the round robin is built.
 */
export function buildRandomDoublesPairing(
  participants: ParticipantInput[],
  fixedTeams: [string, string][] = [],
): {
  /** Shuffled basket order used for the draw, before pairing - excludes fixed-team players. */
  seededOrder: string[];
  unseededOrder: string[];
  /** The pre-set teams passed in, unchanged. */
  fixedTeams: Team[];
  /** Teams formed by the random draw, in the order they were drawn. */
  randomTeams: Team[];
  /** Round robin across fixed and random teams together. */
  matchups: TeamMatchup[];
  unpaired: string[];
} {
  const fixedPlayerIds = new Set(fixedTeams.flat());
  const pool = participants.filter((p) => !fixedPlayerIds.has(p.playerId));

  const seeded = shuffle(pool.filter((p) => p.seeded).map((p) => p.playerId));
  const unseeded = shuffle(pool.filter((p) => !p.seeded).map((p) => p.playerId));

  const randomTeams: Team[] = [];
  const pairCount = Math.min(seeded.length, unseeded.length);
  for (let i = 0; i < pairCount; i++) {
    randomTeams.push({ playerIds: [seeded[i], unseeded[i]] });
  }

  const remainder = shuffle([...seeded.slice(pairCount), ...unseeded.slice(pairCount)]);
  for (let i = 0; i + 1 < remainder.length; i += 2) {
    randomTeams.push({ playerIds: [remainder[i], remainder[i + 1]] });
  }
  const unpaired = remainder.length % 2 === 1 ? [remainder[remainder.length - 1]] : [];

  const fixedTeamObjs: Team[] = fixedTeams.map((playerIds) => ({ playerIds }));

  // Round robin: every team (fixed or random) plays every other team exactly once.
  const shuffledTeams = shuffle([...fixedTeamObjs, ...randomTeams]);
  const matchups: TeamMatchup[] = [];
  for (let i = 0; i < shuffledTeams.length; i++) {
    for (let j = i + 1; j < shuffledTeams.length; j++) {
      matchups.push({ sideA: shuffledTeams[i], sideB: shuffledTeams[j] });
    }
  }

  return {
    seededOrder: seeded,
    unseededOrder: unseeded,
    fixedTeams: fixedTeamObjs,
    randomTeams,
    matchups,
    unpaired,
  };
}

export type SinglesMatchup = { sideA: string; sideB: string };

/** Every participant plays every other participant exactly once, in a random order. */
export function buildSinglesRoundRobin(playerIds: string[]): SinglesMatchup[] {
  const shuffled = shuffle(playerIds);
  const matchups: SinglesMatchup[] = [];
  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      matchups.push({ sideA: shuffled[i], sideB: shuffled[j] });
    }
  }
  return shuffle(matchups);
}

export const singlesRandomizeStrategyValues = ["ALL", "SEEDED_SPLIT", "CUSTOM_GROUPS", "GROUPS_12_PLAYOFF"] as const;
export type SinglesRandomizeStrategy = (typeof singlesRandomizeStrategyValues)[number];

export type SinglesGroup = "SEEDED" | "UNSEEDED";
export type GroupedSinglesMatchup = { sideA: string; sideB: string; group: SinglesGroup };

export const SINGLES_GROUP_LABEL: Record<SinglesGroup, string> = {
  SEEDED: "Gold (сіяні)",
  UNSEEDED: "Silver (несіяні)",
};

function roundRobinWithGroup(ids: string[], group: SinglesGroup): GroupedSinglesMatchup[] {
  const matchups: GroupedSinglesMatchup[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      matchups.push({ sideA: ids[i], sideB: ids[j], group });
    }
  }
  return matchups;
}

/**
 * Two independent round robins instead of one: seeded participants only play
 * other seeded participants, unseeded only play other unseeded - the two
 * pools never meet. Each matchup carries which pool it came from so the
 * caller can label the match (e.g. "Gold (сіяні)" / "Silver (несіяні)").
 */
export function buildSeededSinglesRoundRobin(participants: ParticipantInput[]): GroupedSinglesMatchup[] {
  const seeded = shuffle(participants.filter((p) => p.seeded).map((p) => p.playerId));
  const unseeded = shuffle(participants.filter((p) => !p.seeded).map((p) => p.playerId));

  return shuffle([
    ...roundRobinWithGroup(seeded, "SEEDED"),
    ...roundRobinWithGroup(unseeded, "UNSEEDED"),
  ]);
}

/** Admin-assigned round-robin groups for singles (1-6, independent of seeding). */
export const MAX_TOURNAMENT_GROUPS = 6;

export type GroupParticipantInput = { playerId: string; group: number };
export type CustomGroupMatchup = { sideA: string; sideB: string; group: number };

/** Groups are shown to admins/players as letters (A-F) rather than raw numbers - storage/sorting stays numeric (1-6) throughout, this is display-only. */
const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F"];

export function groupRoundLabel(group: number): string {
  return `Група ${GROUP_LETTERS[group - 1] ?? group}`;
}

/** groupRoundLabel(n), unless the admin gave group `n` its own free-text name via "Додати групу" (see createTournamentGroupAction) - those live outside the fixed 1-6/A-F range and aren't derivable from the number alone. */
export function resolveGroupLabel(group: number, customNames: Map<number, string>): string {
  return customNames.get(group) ?? groupRoundLabel(group);
}

/**
 * Randomly fills in a group for every participant who doesn't already have
 * one, spread evenly across whichever groups are already in use (e.g. an
 * admin seeds 4 players one per group, and the rest get dealt out to
 * balance those same groups) - returns only the *new* assignments, keyed by
 * playerId, so the caller can both persist them and use them for this draw.
 * Groups are dealt from a shuffled order each call, so when the total
 * doesn't divide evenly the "extra" player doesn't always land on the same
 * group. Returns an empty map if no group is in use yet - there's nothing
 * to balance against.
 */
export function assignUngroupedToGroups(
  participants: { playerId: string; group: number | null }[],
): Map<string, number> {
  const activeGroups = shuffle(
    [...new Set(participants.filter((p) => p.group != null).map((p) => p.group!))],
  );
  const assignment = new Map<string, number>();
  if (activeGroups.length === 0) return assignment;

  const ungrouped = shuffle(participants.filter((p) => p.group == null).map((p) => p.playerId));
  ungrouped.forEach((playerId, i) => {
    assignment.set(playerId, activeGroups[i % activeGroups.length]);
  });
  return assignment;
}

/**
 * Independent round robin per admin-assigned group - groups never play each
 * other, generalizing buildSeededSinglesRoundRobin's fixed 2-pool split to
 * however many of the 1-6 groups are actually in use.
 */
export function buildCustomGroupsSinglesRoundRobin(
  participants: GroupParticipantInput[],
): CustomGroupMatchup[] {
  const byGroup = new Map<number, string[]>();
  for (const p of participants) {
    const list = byGroup.get(p.group);
    if (list) list.push(p.playerId);
    else byGroup.set(p.group, [p.playerId]);
  }

  const matchups: CustomGroupMatchup[] = [];
  for (const group of [...byGroup.keys()].sort((a, b) => a - b)) {
    const ids = shuffle(byGroup.get(group)!);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        matchups.push({ sideA: ids[i], sideB: ids[j], group });
      }
    }
  }
  return shuffle(matchups);
}

export type Groups12PlayoffMatchup = { sideA: string; sideB: string; group: number };

/**
 * Draws the group stage for the "GROUPS_12_PLAYOFF" format (see
 * docs/GROUPS12_PLAYOFF.md): shuffles the 4 seeded players one-per-group
 * across groups 1-4, splits the remaining 8 unseeded players 2-per-group,
 * then round-robins within each group via buildCustomGroupsSinglesRoundRobin.
 * Caller guarantees exactly 4 seeded + 8 unseeded participants (12 total) -
 * see drawGroups12PlayoffAction. Unlike assignUngroupedToGroups, this always
 * draws all 12 fresh rather than dealing in an ungrouped remainder around an
 * existing assignment - a partial pre-existing group can't generally satisfy
 * "exactly 1 seed + 2 unseeded per group".
 */
export function buildGroups12PlayoffDraw(
  participants: ParticipantInput[],
): { groupAssignment: Map<string, number>; matchups: Groups12PlayoffMatchup[] } {
  const seeded = shuffle(participants.filter((p) => p.seeded).map((p) => p.playerId));
  const unseeded = shuffle(participants.filter((p) => !p.seeded).map((p) => p.playerId));

  const groupAssignment = new Map<string, number>();
  seeded.forEach((playerId, i) => groupAssignment.set(playerId, i + 1));
  unseeded.forEach((playerId, i) => groupAssignment.set(playerId, (i % 4) + 1));

  const matchups = buildCustomGroupsSinglesRoundRobin(
    [...groupAssignment.entries()].map(([playerId, group]) => ({ playerId, group })),
  );
  return { groupAssignment, matchups };
}

/** Doubles mirror of singlesRandomizeStrategyValues - doubles has no separate "seeded vs seeded" strategy since every draw already pairs one seeded with one unseeded player. */
export const doublesRandomizeStrategyValues = ["ALL", "CUSTOM_GROUPS"] as const;
export type DoublesRandomizeStrategy = (typeof doublesRandomizeStrategyValues)[number];

/**
 * Doubles variant of assignUngroupedToGroups: deals a group to every
 * participant who doesn't have one, balanced across the groups already in
 * use - except a fixed pair (`fixedPairs`) is dealt as a single unit so both
 * of its players always land in the same group together, rather than being
 * balanced independently and risking a team split across two groups. A pair
 * with one already-grouped player skips the balancing draw entirely - the
 * other player just inherits that same group directly.
 *
 * When nobody has a group yet, there's nothing to balance against - unless
 * the caller passes `groupCount`, in which case groups 1..groupCount are
 * freshly minted as the "active groups" and everyone (individuals and fixed
 * pairs alike) is dealt across them from scratch. This lets an admin split a
 * roster - and its pre-set pairs - into N random groups without first
 * hand-assigning a group to anyone in the roster.
 */
export function assignUngroupedDoublesToGroups(
  participants: { playerId: string; group: number | null }[],
  fixedPairs: [string, string][] = [],
  groupCount?: number,
): Map<string, number> {
  const existingGroups = shuffle(
    [...new Set(participants.filter((p) => p.group != null).map((p) => p.group!))],
  );
  const activeGroups =
    existingGroups.length > 0
      ? existingGroups
      : groupCount
        ? shuffle(Array.from({ length: groupCount }, (_, i) => i + 1))
        : [];
  const assignment = new Map<string, number>();
  if (activeGroups.length === 0) return assignment;

  const groupById = new Map(participants.map((p) => [p.playerId, p.group]));
  const fixedPlayerIds = new Set(fixedPairs.flat());

  type Unit = { playerIds: string[]; group: number | null };
  const units: Unit[] = fixedPairs.map(([a, b]) => ({
    playerIds: [a, b],
    group: groupById.get(a) ?? groupById.get(b) ?? null,
  }));
  for (const p of participants) {
    if (fixedPlayerIds.has(p.playerId)) continue;
    units.push({ playerIds: [p.playerId], group: p.group });
  }

  const ungroupedUnits = shuffle(units.filter((u) => u.group == null));
  ungroupedUnits.forEach((unit, i) => {
    const group = activeGroups[i % activeGroups.length];
    for (const playerId of unit.playerIds) assignment.set(playerId, group);
  });

  // A fixed pair that already had a group pinned (on one or both sides):
  // persist that same group for whichever player doesn't already have it,
  // even though it wasn't part of the balancing draw above. Compares against
  // the resolved `group` (not just "was it null") so that if the two ever
  // came in with two different non-null groups, the one that lost the ??
  // above still gets moved onto `group` instead of silently keeping its own
  // different group - the exact split this function exists to prevent. The
  // current caller (drawDoublesGroupsAction) already rejects that case
  // before calling in, so this is defense-in-depth for callers that don't.
  for (const { playerIds, group } of units) {
    if (group == null || playerIds.length === 1) continue;
    for (const playerId of playerIds) {
      if (groupById.get(playerId) !== group) assignment.set(playerId, group);
    }
  }

  return assignment;
}

export type GroupedDoublesMatchup = { sideA: Team; sideB: Team; group: number };

/**
 * Doubles mirror of buildCustomGroupsSinglesRoundRobin: buckets participants
 * (and any fixed pairs) by their resolved group, then runs the existing
 * seeded/unseeded basket draw (buildRandomDoublesPairing) independently
 * inside each group - teams never form across a group boundary, and a group
 * plays round robin only against itself, generalizing the flat ("ALL")
 * doubles draw to however many of the 1-6 groups are in use.
 */
export function buildCustomGroupsDoublesRoundRobin(
  participants: { playerId: string; seeded: boolean; group: number }[],
  fixedPairs: [string, string][] = [],
): {
  fixedTeams: (Team & { group: number })[];
  randomTeams: (Team & { group: number })[];
  matchups: GroupedDoublesMatchup[];
  unpaired: string[];
} {
  const groupById = new Map(participants.map((p) => [p.playerId, p.group]));

  const byGroup = new Map<number, { playerId: string; seeded: boolean }[]>();
  for (const p of participants) {
    const list = byGroup.get(p.group);
    if (list) list.push(p);
    else byGroup.set(p.group, [p]);
  }

  const fixedPairsByGroup = new Map<number, [string, string][]>();
  for (const pair of fixedPairs) {
    // Caller guarantees both players resolve to the same group before
    // reaching here (see drawDoublesGroupsAction's validation).
    const group = groupById.get(pair[0])!;
    const list = fixedPairsByGroup.get(group);
    if (list) list.push(pair);
    else fixedPairsByGroup.set(group, [pair]);
  }

  const fixedTeams: (Team & { group: number })[] = [];
  const randomTeams: (Team & { group: number })[] = [];
  const matchups: GroupedDoublesMatchup[] = [];
  const unpaired: string[] = [];

  for (const group of [...byGroup.keys()].sort((a, b) => a - b)) {
    const groupParticipants = byGroup.get(group)!;
    const groupFixedPairs = fixedPairsByGroup.get(group) ?? [];
    const draw = buildRandomDoublesPairing(
      groupParticipants.map((p) => ({ playerId: p.playerId, seeded: p.seeded })),
      groupFixedPairs,
    );
    fixedTeams.push(...draw.fixedTeams.map((t) => ({ ...t, group })));
    randomTeams.push(...draw.randomTeams.map((t) => ({ ...t, group })));
    matchups.push(...draw.matchups.map((m) => ({ ...m, group })));
    unpaired.push(...draw.unpaired);
  }

  return { fixedTeams, randomTeams, matchups: shuffle(matchups), unpaired };
}
