/**
 * Standard playoff round labels, curated for the "Раунд" picker in
 * create-match-dialog.tsx and for rendering a tournament's playoff section
 * in a fixed stage order. This is purely a display-layer whitelist -
 * Match.round stays free text in the schema, so any other value (randomizer
 * group labels, custom text) keeps working exactly as it does today.
 */
/** The tournament's deciding match - shared between both round sets, and the one whose winner is the champion. */
export const FINAL_ROUND = "Фінал";

export const BRACKET_ROUNDS = ["1/8", "1/4", "1/2", FINAL_ROUND] as const;
export const PLACEMENT_ROUNDS = [
  "За 11 місце",
  "За 9 місце",
  "За 7 місце",
  "За 5 місце",
  "За 3 місце",
  FINAL_ROUND,
] as const;

/**
 * Same bracket stages as BRACKET_ROUNDS, but with the bronze-medal match
 * spliced in before the final - a bracket's "За 3 місце" is played by the
 * semifinal losers alongside the final, so the round picker offers it here
 * too (it's also offered under "Матч за місце", since a placement-only
 * tournament can end in a bare "За 3 місце" without any bracket stages).
 */
export const BRACKET_ROUND_PICKER_OPTIONS = ["1/8", "1/4", "1/2", "За 3 місце", FINAL_ROUND] as const;

/** All 9 distinct curated round strings ("Фінал" counted once). */
export const PLAYOFF_ROUNDS: readonly string[] = Array.from(
  new Set<string>([...BRACKET_ROUNDS, ...PLACEMENT_ROUNDS]),
);

export function isPlayoffRound(round: string | null | undefined): boolean {
  return round != null && PLAYOFF_ROUNDS.includes(round);
}

/**
 * A Фінал playoff match decides the champion on its own - showing a
 * standings-table trophy too would be misleading whenever the round-robin
 * leader isn't the one who actually won the final.
 */
export function hasFinalMatch(matches: { round: string | null }[]): boolean {
  return matches.some((m) => m.round === FINAL_ROUND);
}

/**
 * Snaps a round value to its canonical curated spelling when it matches one
 * case-insensitively after trimming (e.g. an admin typing "фінал" or
 * "Фінал " into the round picker's free-text "Свій варіант" field). Both the
 * champion-trophy check and Set Club scoring compare Match.round by exact
 * string equality, so an off-case/whitespace variant would otherwise
 * silently fail to match despite clearly meaning the same round.
 */
export function canonicalizeRound(round: string | null): string | null {
  if (round == null) return null;
  const trimmed = round.trim();
  if (!trimmed) return null;
  const canonical = PLAYOFF_ROUNDS.find((r) => r.toLowerCase() === trimmed.toLowerCase());
  return canonical ?? trimmed;
}

/**
 * The playoff section always renders in this exact stage order, regardless
 * of which rounds a given tournament actually uses - deepest/most-important
 * stage first: the final and its bronze-medal match, then the round that
 * produced them, then that round's own placement matches, and so on down to
 * the shallowest stage.
 */
export const PLAYOFF_DISPLAY_ORDER: readonly string[] = [
  FINAL_ROUND,
  "За 3 місце",
  "1/2",
  "За 5 місце",
  "За 7 місце",
  "1/4",
  "За 9 місце",
  "За 11 місце",
  "1/8",
];

export type PlayoffGroup<T> = { round: string; matches: T[] };

/** Groups playoff-section matches into ordered, non-empty sections, per PLAYOFF_DISPLAY_ORDER. */
export function groupPlayoffMatches<T extends { round: string | null }>(matches: T[]): PlayoffGroup<T>[] {
  return PLAYOFF_DISPLAY_ORDER.map((round) => ({
    round,
    matches: matches.filter((m) => m.round === round),
  })).filter((group) => group.matches.length > 0);
}
