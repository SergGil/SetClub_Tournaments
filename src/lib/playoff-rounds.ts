/**
 * Standard playoff round labels, curated for the "Раунд" picker in
 * create-match-dialog.tsx and for auto-detecting how to render a
 * tournament's playoff matches (bracket columns vs a placement list). This
 * is purely a display-layer whitelist - Match.round stays free text in the
 * schema, so any other value (randomizer group labels, custom text) keeps
 * working exactly as it does today.
 */
/** The tournament's deciding match - shared between both round sets, and the one whose winner is the champion. */
export const FINAL_ROUND = "Фінал";

export const BRACKET_ROUNDS = ["1/8", "1/4", "1/2", FINAL_ROUND] as const;
export const PLACEMENT_ROUNDS = ["За 7 місце", "За 5 місце", "За 3 місце", FINAL_ROUND] as const;

/** All 7 distinct curated round strings ("Фінал" counted once). */
export const PLAYOFF_ROUNDS: readonly string[] = Array.from(
  new Set<string>([...BRACKET_ROUNDS, ...PLACEMENT_ROUNDS]),
);

export function isPlayoffRound(round: string | null | undefined): boolean {
  return round != null && PLAYOFF_ROUNDS.includes(round);
}

export type PlayoffMode = "bracket" | "list" | null;

/** Pure function over the round strings actually present among a tournament's matches. */
export function detectPlayoffMode(rounds: (string | null | undefined)[]): PlayoffMode {
  const present = new Set(rounds.filter(isPlayoffRound) as string[]);
  if (present.size === 0) return null;
  if (["1/8", "1/4", "1/2"].some((r) => present.has(r))) return "bracket";
  if (["За 7 місце", "За 5 місце", "За 3 місце"].some((r) => present.has(r))) return "list";
  return "bracket"; // only "Фінал" present - a lone final looks the same either way
}

export type PlayoffGroup<T> = { round: string; matches: T[] };

/**
 * Groups playoff-section matches into ordered, non-empty columns/sections.
 * Bracket mode orders by bracket stage, then appends any placement-exclusive
 * rounds present (e.g. a "За 3 місце" match run alongside a bracket) after
 * "Фінал" so no in-playoff-section match is silently dropped from the
 * summary just because a bracket match exists elsewhere in the tournament.
 * List mode can't hit that case, since any bracket-exclusive round forces
 * bracket mode - it orders strictly За 7 -> За 5 -> За 3 -> Фінал.
 */
export function groupPlayoffMatches<T extends { round: string | null }>(
  matches: T[],
  mode: "bracket" | "list",
): PlayoffGroup<T>[] {
  const order: readonly string[] =
    mode === "bracket"
      ? [...BRACKET_ROUNDS, "За 7 місце", "За 5 місце", "За 3 місце"]
      : PLACEMENT_ROUNDS;

  return order
    .map((round) => ({ round, matches: matches.filter((m) => m.round === round) }))
    .filter((group) => group.matches.length > 0);
}
