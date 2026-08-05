import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/generated/**", "src/components/ui/**", "src/app/**", "src/**/*.d.ts"],
      // Global (not per-file) floor - a handful of thin wiring files
      // (src/lib/db.ts, src/lib/auth.ts, src/proxy.ts, src/lib/audit.ts...)
      // are legitimately near 0% since they're config/glue rather than
      // business logic, so a per-file floor would fail on those by design
      // rather than catching a real regression. Set a few points below the
      // measured baseline (~91.6/83.7/91/92.7 stmts/branches/funcs/lines) so
      // normal fluctuation doesn't trip it, but a real drop - e.g. a big
      // untested feature landing in src/lib - fails CI instead of silently
      // eroding the numbers this file used to just report.
      thresholds: {
        statements: 90,
        branches: 82,
        functions: 88,
        lines: 91,
      },
    },
  },
});
