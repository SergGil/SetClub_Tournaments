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

export const singlesRandomizeStrategyValues = ["ALL", "SEEDED_SPLIT", "CUSTOM_GROUPS"] as const;
export type SinglesRandomizeStrategy = (typeof singlesRandomizeStrategyValues)[number];

export type SinglesGroup = "SEEDED" | "UNSEEDED";
export type GroupedSinglesMatchup = { sideA: string; sideB: string; group: SinglesGroup };

export const SINGLES_GROUP_LABEL: Record<SinglesGroup, string> = {
  SEEDED: "Сіяні",
  UNSEEDED: "Несіяні",
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
 * caller can label the match (e.g. "Сіяні" / "Несіяні").
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

export function groupRoundLabel(group: number): string {
  return `Група ${group}`;
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
