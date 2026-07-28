import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// So process.env.E2E_TEST_LOGIN_SECRET is visible to the test runner
// process itself, not just the dev server child process it spawns.
config();

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
