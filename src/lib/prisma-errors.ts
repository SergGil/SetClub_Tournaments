function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** True for a unique-constraint violation (P2002), e.g. a duplicate email. */
export function isUniqueConstraintError(error: unknown): boolean {
  return prismaErrorCode(error) === "P2002";
}

/**
 * Which column(s) a P2002 unique-constraint violation hit, or null if it's
 * some other error. Checks two shapes: the classic Prisma query-engine
 * `meta.target`, and @prisma/adapter-neon's shape (confirmed empirically -
 * this driver adapter never populates `meta.target` at all, instead nesting
 * the raw Postgres constraint under `meta.driverAdapterError.cause.constraint.fields`,
 * with column names sometimes double-quoted like `"tournamentId"`). Without
 * this second branch, every caller silently got an empty array back for
 * every P2002 under this driver - `uniqueConstraintTarget(error)` returning
 * `[]` (truthy) instead of `null` meant callers checking `if (target)` took
 * the "found a target" branch but every `target.includes(...)` check failed,
 * so every unique-constraint conflict fell through to the same generic
 * message regardless of which column actually collided.
 */
export function uniqueConstraintTarget(error: unknown): string[] | null {
  if (!isUniqueConstraintError(error)) return null;
  const meta = (error as { meta?: Record<string, unknown> }).meta;
  if (!meta) return [];
  if (Array.isArray(meta.target)) return meta.target as string[];
  const fields = (
    meta.driverAdapterError as
      | { cause?: { constraint?: { fields?: unknown } } }
      | undefined
  )?.cause?.constraint?.fields;
  if (Array.isArray(fields)) {
    return fields.map((field) => String(field).replace(/^"|"$/g, ""));
  }
  return [];
}

/** True when a row expected to exist (update/delete by id) was missing - typically a concurrent delete. */
export function isRecordNotFoundError(error: unknown): boolean {
  return prismaErrorCode(error) === "P2025";
}

/** True for a foreign-key violation (P2003), e.g. a referenced player/tournament was deleted concurrently. */
export function isForeignKeyError(error: unknown): boolean {
  return prismaErrorCode(error) === "P2003";
}
