/**
 * Tag for every cached Padel stats/rating query - Padel twin of
 * src/lib/stats.ts's STATS_CACHE_TAG. Match-mutating Padel actions call
 * updateTag(PADEL_STATS_CACHE_TAG) so stats update immediately once a score
 * changes. The rest of stats.ts (getAllPlayerStats, getHeadToHeadMatchRows,
 * getMonthlyActivity, getTournamentStandings) gets its Padel twin in the
 * rating-engine milestone, once the public /padel/leaderboard page that
 * needs them exists - this file only carries the cache tag for now, since
 * every mutating action needs it immediately to keep stats in sync.
 */
export const PADEL_STATS_CACHE_TAG = "padel-match-stats";
