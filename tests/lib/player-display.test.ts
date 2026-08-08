import { describe, expect, it } from "vitest";

import { displayName, fullDisplayName } from "@/lib/player-display";

describe("displayName", () => {
  it("returns the real name when no nickname is set", () => {
    expect(displayName({ name: "Данилюк Євген", nickname: null })).toBe("Данилюк Євген");
  });

  it("returns the real name when nickname is undefined", () => {
    expect(displayName({ name: "Данилюк Євген" })).toBe("Данилюк Євген");
  });

  it("returns the nickname when one is set", () => {
    expect(displayName({ name: "Данилюк Євген", nickname: "Женя" })).toBe("Женя");
  });

  it("treats a whitespace-only nickname as unset", () => {
    expect(displayName({ name: "Данилюк Євген", nickname: "   " })).toBe("Данилюк Євген");
  });

  it("treats an empty string nickname as unset", () => {
    expect(displayName({ name: "Данилюк Євген", nickname: "" })).toBe("Данилюк Євген");
  });
});

describe("fullDisplayName", () => {
  it("returns just the name when no nickname is set", () => {
    expect(fullDisplayName({ name: "Данилюк Євген", nickname: null })).toBe("Данилюк Євген");
  });

  it("returns 'Name (Nickname)' when a nickname is set", () => {
    expect(fullDisplayName({ name: "Данилюк Євген", nickname: "Женя" })).toBe("Данилюк Євген (Женя)");
  });

  it("treats a whitespace-only nickname as unset", () => {
    expect(fullDisplayName({ name: "Данилюк Євген", nickname: "  " })).toBe("Данилюк Євген");
  });
});
