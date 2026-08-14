import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression guard for the "Padel is a fully separate engine mirroring
 * Tennis field-for-field" duplication pattern (see the schema comment above
 * `model PadelTournament` in prisma/schema.prisma) - this exact class of bug
 * (a feature shipped/changed on one side, never ported to its twin) is what
 * two same-day "Глибокий аудит" passes already found and fixed (see
 * docs/CHANGELOG.md), plus the season-share-card gap a manual review caught
 * afterward (docs/SHARE_CARDS.md's "Річна картка тепер рахує й Падел" entry)
 * - `getSeasonMatchCount`/`getSeasonTournamentCount` had no Padel twin at
 * all, so a club-wide share card silently read Tennis only.
 *
 * Walks each declared Tennis/Padel file pair and flags a top-level
 * `export function`/`export const` that exists on only one side. This is a
 * cheap, mechanical net (name presence only, not behavior) - it won't catch
 * e.g. a route that forgets to *call* an existing Padel twin (which is
 * exactly what slipped through the season-card bug above), only a twin that
 * was never written in the first place. Still worth having: it turns "one
 * more manual audit finds this eventually" into "CI fails on the next PR
 * that adds the asymmetry."
 *
 * Intentionally not exhaustive over the whole Tennis/Padel surface - some
 * modules (randomize-pairs.ts, standings-sort.ts, validation/*, the Player
 * table itself) are already fully shared rather than duplicated, so they
 * have no "twin" to pair against.
 */

const ROOT = path.resolve(__dirname, "..", "..");

const PAIRS: [tennis: string, padel: string][] = [
  ["src/lib/actions/bracket-snapshot.ts", "src/lib/actions/padel-bracket-snapshot.ts"],
  ["src/lib/actions/match-randomize-shared.ts", "src/lib/actions/padel-match-randomize-shared.ts"],
  ["src/lib/actions/matches.ts", "src/lib/actions/padel-matches.ts"],
  ["src/lib/actions/photos.ts", "src/lib/actions/padel-photos.ts"],
  ["src/lib/actions/randomize-doubles.ts", "src/lib/actions/padel-randomize-doubles.ts"],
  ["src/lib/actions/randomize-singles-groups12.ts", "src/lib/actions/padel-randomize-singles-groups12.ts"],
  ["src/lib/actions/randomize-singles.ts", "src/lib/actions/padel-randomize-singles.ts"],
  ["src/lib/actions/teams.ts", "src/lib/actions/padel-teams.ts"],
  ["src/lib/actions/ties.ts", "src/lib/actions/padel-ties.ts"],
  ["src/lib/actions/tournaments.ts", "src/lib/actions/padel-tournaments.ts"],
  ["src/lib/export/tournaments-csv.ts", "src/lib/export/padel-tournaments-csv.ts"],
  ["src/lib/stats.ts", "src/lib/padel-stats.ts"],
  ["src/lib/tournament-standings.ts", "src/lib/padel-tournament-standings.ts"],
  ["src/lib/tournament-ties.ts", "src/lib/padel-tournament-ties.ts"],
  ["src/lib/queries/matches.ts", "src/lib/queries/padel-matches.ts"],
  ["src/lib/queries/photos.ts", "src/lib/queries/padel-photos.ts"],
  ["src/lib/queries/tournament-teams.ts", "src/lib/queries/padel-tournament-teams.ts"],
  ["src/lib/queries/tournaments.ts", "src/lib/queries/padel-tournaments.ts"],
  ["src/lib/rating/ratings-data.ts", "src/lib/rating/padel-ratings-data.ts"],
  ["src/lib/rating/snapshot.ts", "src/lib/rating/padel-snapshot.ts"],
];

/**
 * Normalized (see `normalize` below) export names that are legitimately
 * one-sided - every entry needs a reason, since the whole point of this
 * test is that a one-sided export is surprising by default.
 */
const ALLOWED_ASYMMETRY: Record<string, string> = {
  gettournamentswithphotosacrosssports:
    "queries/photos.ts only - reads both PadelPhoto and Photo itself to build the merged /gallery feed, so it has no Padel-side twin to pair against",
};

/**
 * Case-folds and strips every occurrence of "padel" (plus a stray
 * underscore it leaves behind, e.g. "PADEL_STATS_CACHE_TAG" ->
 * "STATS_CACHE_TAG", not "_STATS_CACHE_TAG") so a Tennis name and its Padel
 * twin - however they're cased/prefixed - normalize to the same string:
 * `getSeasonMatchCount`/`getPadelSeasonMatchCount`,
 * `STATS_CACHE_TAG`/`PADEL_STATS_CACHE_TAG`,
 * `matchWithDetailsInclude`/`padelMatchWithDetailsInclude`.
 */
function normalize(name: string): string {
  return name
    .replace(/padel/gi, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function extractExportNames(absPath: string): Set<string> {
  const src = readFileSync(absPath, "utf8");
  const names = new Set<string>();
  const re = /^export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    names.add(normalize(match[1]));
  }
  return names;
}

describe("Tennis/Padel twin-file export parity", () => {
  it.each(PAIRS)("%s <-> %s", (tennisRel, padelRel) => {
    const tennisNames = extractExportNames(path.join(ROOT, tennisRel));
    const padelNames = extractExportNames(path.join(ROOT, padelRel));

    const tennisOnly = [...tennisNames]
      .filter((name) => !padelNames.has(name) && !(name in ALLOWED_ASYMMETRY))
      .sort();
    const padelOnly = [...padelNames]
      .filter((name) => !tennisNames.has(name) && !(name in ALLOWED_ASYMMETRY))
      .sort();

    expect(
      { tennisOnly, padelOnly },
      `${tennisRel} and ${padelRel} export different names - if this is intentional, add the ` +
        `normalized name to ALLOWED_ASYMMETRY in this test with a reason.`,
    ).toEqual({ tennisOnly: [], padelOnly: [] });
  });
});
