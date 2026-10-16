import { describe, expect, it } from "vitest";

import {
  abbreviatedName,
  displayName,
  fullDisplayName,
  seededFirst,
  seededFirstPerSide,
  wonVerb,
} from "@/lib/player-display";

describe("seededFirst", () => {
  const players = [{ playerId: "p1" }, { playerId: "p2" }];

  it("moves the seeded player to the front", () => {
    expect(seededFirst(players, new Set(["p2"]))).toEqual([{ playerId: "p2" }, { playerId: "p1" }]);
  });

  it("keeps the incoming order when the first player is already the seeded one", () => {
    expect(seededFirst(players, new Set(["p1"]))).toEqual(players);
  });

  it("keeps the incoming order when neither or both players are seeded", () => {
    expect(seededFirst(players, new Set())).toEqual(players);
    expect(seededFirst(players, new Set(["p1", "p2"]))).toEqual(players);
  });

  it("does not mutate its input", () => {
    const input = [{ playerId: "p1" }, { playerId: "p2" }];
    seededFirst(input, new Set(["p2"]));
    expect(input.map((p) => p.playerId)).toEqual(["p1", "p2"]);
  });
});

describe("seededFirstPerSide", () => {
  const players = [
    { side: "A", playerId: "p1" },
    { side: "A", playerId: "p2" },
    { side: "B", playerId: "p3" },
    { side: "B", playerId: "p4" },
  ];

  it("puts the seeded player first within each side", () => {
    expect(seededFirstPerSide(players, new Set(["p2", "p4"]))).toEqual([
      { side: "A", playerId: "p2" },
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p4" },
      { side: "B", playerId: "p3" },
    ]);
  });

  it("never moves a player into the other side's slots, even when the sides are interleaved", () => {
    const interleaved = [
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p3" },
      { side: "A", playerId: "p2" },
      { side: "B", playerId: "p4" },
    ];
    expect(seededFirstPerSide(interleaved, new Set(["p2", "p4"]))).toEqual([
      { side: "A", playerId: "p2" },
      { side: "B", playerId: "p4" },
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p3" },
    ]);
  });

  it("leaves a singles match's A/B order alone even when only side B is seeded", () => {
    const singles = [
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p2" },
    ];
    expect(seededFirstPerSide(singles, new Set(["p2"]))).toEqual(singles);
  });

  it("keeps the order of a side with no seed or two seeds, and does not mutate its input", () => {
    const input = [...players];
    expect(seededFirstPerSide(input, new Set(["p3", "p4"]))).toEqual(players);
    expect(input).toEqual(players);
  });
});

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

describe("abbreviatedName", () => {
  it("abbreviates a two-word name to surname + first-name initial", () => {
    expect(abbreviatedName({ name: "Петровський Андрій", nickname: null })).toBe("Петровський А.");
  });

  it("falls back to the name unchanged for a single-word entry (nickname-only or no first name on file)", () => {
    expect(abbreviatedName({ name: "Пляшечник", nickname: null })).toBe("Пляшечник");
  });

  it("abbreviates the nickname (not the real name) when one is set - same nickname-first precedence as displayName", () => {
    expect(abbreviatedName({ name: "Петровський Андрій", nickname: "Ваня Петровський" })).toBe("Ваня П.");
  });

  it("collapses repeated internal whitespace the same way displayName's callers already assume", () => {
    expect(abbreviatedName({ name: "Петровський   Андрій", nickname: null })).toBe("Петровський А.");
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
