import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ACTIONS_DIR = path.resolve(__dirname, "../../src/lib/actions");

/**
 * Every export of a "use server" file is a public Server Action endpoint. The `*Core(session, ...)`
 * helpers trust a caller-supplied `session` (the guard runs in the Action/route wrapper), so they
 * must live in `*-core.ts` modules WITHOUT the directive - otherwise anyone who learned the action
 * id could call them with a forged session and skip authorization entirely.
 */
describe('"use server" action files', () => {
  const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"));
  const serverFiles = files.filter((f) => /^\s*"use server";/m.test(readFileSync(path.join(ACTIONS_DIR, f), "utf8")));

  it("finds the action files", () => {
    expect(serverFiles.length).toBeGreaterThan(10);
  });

  it.each(serverFiles)("%s exports no *Core function", (file) => {
    const source = readFileSync(path.join(ACTIONS_DIR, file), "utf8");
    const exported = [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]);
    expect(exported.filter((name) => name.endsWith("Core"))).toEqual([]);
  });

  it.each(files.filter((f) => f.endsWith("-core.ts")))("%s is not a server-action module", (file) => {
    const source = readFileSync(path.join(ACTIONS_DIR, file), "utf8");
    expect(source).not.toMatch(/^\s*"use server";/m);
  });
});
