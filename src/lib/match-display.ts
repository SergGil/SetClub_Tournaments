import { groupRoundLabel, MAX_TOURNAMENT_GROUPS, SINGLES_GROUP_LABEL } from "@/lib/randomize-pairs";

export const MATCH_TYPE_LABEL = { SINGLES: "1×1", DOUBLES: "2×2" } as const;

// SINGLES_GROUP_LABEL used to be the plain "Сіяні"/"Несіяні", and
// groupRoundLabel used to spell out the group as a plain number ("Група 1")
// instead of a letter ("Група A") - matches created before either label
// changed still have the old string stored in `round` (it's data, not just
// display text), so old and new tournaments would otherwise show mismatched
// wording for the same group. Normalizing here is display-only and doesn't
// touch the database.
const LEGACY_ROUND_LABEL: Record<string, string> = {
  Сіяні: SINGLES_GROUP_LABEL.SEEDED,
  Несіяні: SINGLES_GROUP_LABEL.UNSEEDED,
  ...Object.fromEntries(
    Array.from({ length: MAX_TOURNAMENT_GROUPS }, (_, i) => [`Група ${i + 1}`, groupRoundLabel(i + 1)]),
  ),
};

export function normalizeRoundLabel(round: string): string {
  return LEGACY_ROUND_LABEL[round] ?? round;
}
