import { DIRECTION_FORMS, MATCH_FORMS, pluralizeUk, PLAYER_FORMS, TOURNAMENT_FORMS } from "@/lib/pluralize";
import type { HomeStats } from "@/lib/queries/home-stats";

// Static, not a DB fact - the club has exactly 3 public directions (Tennis/
// Coffee/Padel, AdminDomain enum), no table to count that against.
const CLUB_DIRECTIONS = 3;

/**
 * Value + label pairs for the homepage stats strip (HomeStats) and its
 * Markdown copy (agent-markdown.ts). The label's word has to agree with its
 * own count (22 турніри, not "22 турнірів" - see pluralizeUk) - hardcoding
 * one plural form broke for every count outside the "5+" bucket (e.g.
 * showed "43 ГРАВЦІВ" instead of "43 ГРАВЦІ").
 */
export function homeStatItems(stats: HomeStats): { value: number; label: string }[] {
  return [
    { value: stats.tournamentsCount, label: `${pluralizeUk(stats.tournamentsCount, TOURNAMENT_FORMS)} зіграно` },
    { value: stats.playersCount, label: `${pluralizeUk(stats.playersCount, PLAYER_FORMS)} у клубі` },
    { value: stats.matchesCount, label: `${pluralizeUk(stats.matchesCount, MATCH_FORMS)} у базі` },
    { value: CLUB_DIRECTIONS, label: `${pluralizeUk(CLUB_DIRECTIONS, DIRECTION_FORMS)} клубу` },
  ];
}
