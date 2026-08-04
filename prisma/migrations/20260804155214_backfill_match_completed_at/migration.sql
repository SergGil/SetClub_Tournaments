-- Backfill completedAt for matches that finished before the column existed
-- (added in 20260801131156_add_match_completed_at with no backfill). Falls
-- back to scheduledDate, then createdAt - same convention already used by
-- getResultYears() in src/lib/stats.ts for year-bucketing older matches.
UPDATE "matches"
SET "completedAt" = COALESCE("scheduledDate", "createdAt")
WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;
