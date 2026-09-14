import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// So process.env.E2E_TEST_LOGIN_SECRET is visible to the test runner
// process itself, not just the dev server child process it spawns.
// Mirrors Next.js's own env precedence (.env.local overrides .env) -
// loading only .env here let the two drift apart locally: e2e specs kept
// posting .env's (stale) secret to /api/test-login while `next dev`
// validated against .env.local's, so every spec's login beforeEach got a
// 403 with no indication why.
config();
config({ path: ".env.local", override: true });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
