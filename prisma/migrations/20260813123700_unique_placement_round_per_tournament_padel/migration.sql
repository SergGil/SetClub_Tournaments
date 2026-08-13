-- Padel equivalent of matches_unique_placement_round_per_tournament (see
-- migration 20260804121402_unique_placement_round_per_tournament) - same
-- guarantee, same six placement-deciding round labels
-- (src/lib/rating/placement.ts's PLACEMENT_ROUND_RANKS), just against
-- padel_matches instead of matches. Intentionally NOT a schema.prisma
-- @@unique/@@index - Prisma's schema DSL doesn't support a partial index
-- with a literal value-list WHERE clause, so this index exists only here
-- and won't show up in `prisma db pull` / `prisma migrate dev`'s drift
-- detection. That's expected, not drift to fix.
CREATE UNIQUE INDEX "padel_matches_unique_placement_round_per_tournament"
ON "padel_matches" ("tournamentId", "round")
WHERE "round" IN ('Фінал', 'За 3 місце', 'За 5 місце', 'За 7 місце', 'За 9 місце', 'За 11 місце');
