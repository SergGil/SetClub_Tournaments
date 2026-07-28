export const TEST_LOGIN_SECRET = process.env.E2E_TEST_LOGIN_SECRET;
export const TEST_ADMIN_EMAIL = "e2e-admin@test.local";

/** True when the two /api/test-login* routes should actually function. */
export function isTestLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && Boolean(TEST_LOGIN_SECRET);
}
