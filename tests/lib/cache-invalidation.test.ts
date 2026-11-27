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

describe("action modules", () => {
  // Regression guard: /api/v1 route handlers call into these - the *-core.ts
  // modules, and plain "use server" actions too (participants, groups,
  // randomizer commits all take a `request` for the mobile app). There Next's
  // updateTag throws AFTER the write has committed, so the mobile app got a
  // 500 for a saved change. The 2026-11-13 fix only covered *-core.ts and
  // missed 20 such calls elsewhere, so this checks every action module.
  // See src/lib/cache-invalidation.ts.
  const actionsDir = path.join(process.cwd(), "src/lib/actions");
  const actionFiles = readdirSync(actionsDir).filter((name) => name.endsWith(".ts"));

  it("finds the action modules to check", () => {
    expect(actionFiles.filter((name) => name.endsWith("-core.ts")).length).toBeGreaterThanOrEqual(6);
    expect(actionFiles).toContain("tournaments.ts");
    expect(actionFiles).toContain("randomize-singles.ts");
  });

  it.each(actionFiles)("%s never calls updateTag", (name) => {
    const source = readFileSync(path.join(actionsDir, name), "utf8");
    expect(source).not.toMatch(/\bupdateTag\s*\(/);
  });
});
