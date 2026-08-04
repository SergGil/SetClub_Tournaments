-- Each of these six rounds decides an exact tournament place, and Set Club
-- scoring (src/lib/rating/placement.ts) assumes exactly one match per round
-- per tournament - two matches both labeled "Фінал" would pay two players
-- for 1st place while nobody gets the place their playoff should have
-- decided (see docs/RATING.md). The app already rejects this at write time
-- (createMatchAction/updateMatchAction), but Match.round stays free text in
-- the schema (Prisma has no DSL for a partial WHERE-list index), so this
-- migration adds the same guarantee as a hard DB constraint, defense in
-- depth against any write path that bypasses those actions.
--
-- Intentionally NOT a schema.prisma @@unique/@@index - Prisma's schema DSL
-- doesn't support a partial index with a literal value-list WHERE clause,
-- so this index exists only here and won't show up in `prisma db pull` /
-- `prisma migrate dev`'s drift detection. That's expected, not drift to fix.
CREATE UNIQUE INDEX "matches_unique_placement_round_per_tournament"
ON "matches" ("tournamentId", "round")
WHERE "round" IN ('Фінал', 'За 3 місце', 'За 5 місце', 'За 7 місце', 'За 9 місце', 'За 11 місце');
