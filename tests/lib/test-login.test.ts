import { afterEach, describe, expect, it, vi } from "vitest";

// TEST_LOGIN_SECRET is captured as a module-level const from process.env at
// import time (see src/lib/test-login.ts), not re-read per call - so every
// scenario below needs a fresh module instance (vi.resetModules() +
// dynamic import) after stubbing env vars, not just mutating them against
// an already-imported module. vi.stubEnv (not direct process.env.NODE_ENV
// assignment) because @types/node marks NODE_ENV read-only.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** `secret: null` stubs to "" - falsy the same way `undefined` is for this module's Boolean()/! checks, and vi.stubEnv can't unset a key entirely. */
async function loadWithEnv(env: { nodeEnv?: string; secret: string | null }) {
  vi.resetModules();
  if (env.nodeEnv !== undefined) vi.stubEnv("NODE_ENV", env.nodeEnv);
  vi.stubEnv("E2E_TEST_LOGIN_SECRET", env.secret ?? "");
  return import("@/lib/test-login");
}

describe("isTestLoginEnabled", () => {
  it("is false in production regardless of the secret - the one hard gate this route relies on", async () => {
    const { isTestLoginEnabled } = await loadWithEnv({ nodeEnv: "production", secret: "s3cr3t" });
    expect(isTestLoginEnabled()).toBe(false);
  });

  it("is false outside production when no secret is configured", async () => {
    const { isTestLoginEnabled } = await loadWithEnv({ nodeEnv: "test", secret: null });
    expect(isTestLoginEnabled()).toBe(false);
  });

  it("is true outside production once a secret is configured", async () => {
    const { isTestLoginEnabled } = await loadWithEnv({ nodeEnv: "test", secret: "s3cr3t" });
    expect(isTestLoginEnabled()).toBe(true);
  });
});

describe("matchesTestLoginSecret", () => {
  it("matches the configured secret", async () => {
    const { matchesTestLoginSecret } = await loadWithEnv({ secret: "s3cr3t" });
    expect(matchesTestLoginSecret("s3cr3t")).toBe(true);
  });

  it("rejects a wrong secret of the same length", async () => {
    const { matchesTestLoginSecret } = await loadWithEnv({ secret: "s3cr3t" });
    expect(matchesTestLoginSecret("s3cr3T")).toBe(false);
  });

  it("rejects a candidate of a different length instead of throwing (timingSafeEqual requires equal-length buffers)", async () => {
    const { matchesTestLoginSecret } = await loadWithEnv({ secret: "s3cr3t" });
    expect(() => matchesTestLoginSecret("short")).not.toThrow();
    expect(matchesTestLoginSecret("short")).toBe(false);
    expect(matchesTestLoginSecret("way-too-long-a-guess")).toBe(false);
  });

  it("rejects a non-string candidate", async () => {
    const { matchesTestLoginSecret } = await loadWithEnv({ secret: "s3cr3t" });
    expect(matchesTestLoginSecret(undefined)).toBe(false);
    expect(matchesTestLoginSecret(null)).toBe(false);
    expect(matchesTestLoginSecret(12345)).toBe(false);
  });

  it("rejects everything when no secret is configured at all", async () => {
    const { matchesTestLoginSecret } = await loadWithEnv({ secret: null });
    expect(matchesTestLoginSecret("anything")).toBe(false);
    expect(matchesTestLoginSecret("")).toBe(false);
  });
});
