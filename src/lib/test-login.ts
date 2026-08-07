import { timingSafeEqual } from "node:crypto";

export const TEST_LOGIN_SECRET = process.env.E2E_TEST_LOGIN_SECRET;
export const TEST_ADMIN_EMAIL = "e2e-admin@test.local";

/** True when the two /api/test-login* routes should actually function. */
export function isTestLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && Boolean(TEST_LOGIN_SECRET);
}

/**
 * Constant-time comparison against TEST_LOGIN_SECRET - only called once
 * isTestLoginEnabled() has already confirmed a secret is configured, so
 * this never runs with an undefined secret. Plain `!==` would leak how many
 * leading bytes of a guess matched via response timing; low real-world risk
 * here (the route is already gated to non-production, so this is
 * defense-in-depth), but the fix costs nothing.
 */
export function matchesTestLoginSecret(candidate: unknown): boolean {
  if (typeof candidate !== "string" || !TEST_LOGIN_SECRET) return false;
  const expected = Buffer.from(TEST_LOGIN_SECRET);
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
