export type ParticipantInput = { playerId: string; seeded: boolean };
export type Team = { playerIds: [string, string] };
export type TeamMatchup = { sideA: Team; sideB: Team };

function shuffle<T>(items: T[]): T[] {
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
 */
export function buildRandomDoublesPairing(participants: ParticipantInput[]): {
  /** Shuffled basket order used for the draw, before pairing. */
  seededOrder: string[];
  unseededOrder: string[];
  /** Teams in the order they were drawn (pairs formed one at a time). */
  teams: Team[];
  matchups: TeamMatchup[];
  unpaired: string[];
} {
  const seeded = shuffle(participants.filter((p) => p.seeded).map((p) => p.playerId));
  const unseeded = shuffle(participants.filter((p) => !p.seeded).map((p) => p.playerId));

  const teams: Team[] = [];
  const pairCount = Math.min(seeded.length, unseeded.length);
  for (let i = 0; i < pairCount; i++) {
    teams.push({ playerIds: [seeded[i], unseeded[i]] });
  }

  const remainder = shuffle([...seeded.slice(pairCount), ...unseeded.slice(pairCount)]);
  for (let i = 0; i + 1 < remainder.length; i += 2) {
    teams.push({ playerIds: [remainder[i], remainder[i + 1]] });
  }
  const unpaired = remainder.length % 2 === 1 ? [remainder[remainder.length - 1]] : [];

  // Round robin: every team plays every other team exactly once.
  const shuffledTeams = shuffle(teams);
  const matchups: TeamMatchup[] = [];
  for (let i = 0; i < shuffledTeams.length; i++) {
    for (let j = i + 1; j < shuffledTeams.length; j++) {
      matchups.push({ sideA: shuffledTeams[i], sideB: shuffledTeams[j] });
    }
  }

  return { seededOrder: seeded, unseededOrder: unseeded, teams, matchups, unpaired };
}
