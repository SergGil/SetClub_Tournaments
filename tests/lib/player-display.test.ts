import { describe, expect, it } from "vitest";

import { displayName, fullDisplayName, wonVerb } from "@/lib/player-display";

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

describe("wonVerb", () => {
  it("uses the feminine form for a single female winner", () => {
    expect(wonVerb([{ gender: "FEMALE" }])).toBe("перемогла");
  });

  it("uses the masculine form for a single male winner", () => {
    expect(wonVerb([{ gender: "MALE" }])).toBe("переміг");
  });

  it("falls back to the masculine form for unknown gender", () => {
    expect(wonVerb([{ gender: null }])).toBe("переміг");
  });

  it("falls back to the masculine form for a doubles pair, even if both are female", () => {
    expect(wonVerb([{ gender: "FEMALE" }, { gender: "FEMALE" }])).toBe("переміг");
  });
});
