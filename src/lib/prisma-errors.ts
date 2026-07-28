function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** True for a unique-constraint violation (P2002), e.g. a duplicate email. */
export function isUniqueConstraintError(error: unknown): boolean {
  return prismaErrorCode(error) === "P2002";
}

/** Which column(s) a P2002 unique-constraint violation hit, or null if it's some other error. */
export function uniqueConstraintTarget(error: unknown): string[] | null {
  if (!isUniqueConstraintError(error)) return null;
  return (error as { meta?: { target?: string[] } }).meta?.target ?? [];
}

/** True when a row expected to exist (update/delete by id) was missing - typically a concurrent delete. */
export function isRecordNotFoundError(error: unknown): boolean {
  return prismaErrorCode(error) === "P2025";
}
