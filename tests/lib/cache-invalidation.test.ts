import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

const { revalidateTagMock } = vi.hoisted(() => ({ revalidateTagMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: revalidateTagMock }));

import { expireCacheTag } from "@/lib/cache-invalidation";

describe("expireCacheTag", () => {
  it("expires the tag immediately via revalidateTag(tag, { expire: 0 }) - the route-handler-safe updateTag", () => {
    expireCacheTag("stats");
    expect(revalidateTagMock).toHaveBeenCalledWith("stats", { expire: 0 });
  });
});

describe("shared *-core action modules", () => {
  // Regression guard: these run inside /api/v1 route handlers too, where
  // Next's updateTag throws AFTER the write has committed - the mobile app
  // then got a 500 for a saved score. See src/lib/cache-invalidation.ts.
  const actionsDir = path.join(process.cwd(), "src/lib/actions");
  const coreFiles = readdirSync(actionsDir).filter((name) => name.endsWith("-core.ts"));

  it("finds the core modules to check", () => {
    expect(coreFiles.length).toBeGreaterThanOrEqual(6);
  });

  it.each(coreFiles)("%s never calls updateTag", (name) => {
    const source = readFileSync(path.join(actionsDir, name), "utf8");
    expect(source).not.toMatch(/\bupdateTag\s*\(/);
  });
});
