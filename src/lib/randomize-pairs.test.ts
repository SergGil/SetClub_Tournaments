import { describe, expect, it } from "vitest";

import { buildRandomDoublesPairing } from "@/lib/randomize-pairs";
import type { ParticipantInput } from "@/lib/randomize-pairs";

function makeParticipants(seededCount: number, unseededCount: number): ParticipantInput[] {
  const seeded = Array.from({ length: seededCount }, (_, i) => ({
    playerId: `seeded-${i}`,
    seeded: true,
  }));
  const unseeded = Array.from({ length: unseededCount }, (_, i) => ({
    playerId: `unseeded-${i}`,
    seeded: false,
  }));
  return [...seeded, ...unseeded];
}

function allPlayerIds(matchups: ReturnType<typeof buildRandomDoublesPairing>["matchups"]) {
  return matchups.flatMap((m) => [...m.sideA.playerIds, ...m.sideB.playerIds]);
}

describe("buildRandomDoublesPairing", () => {
  it("uses every participant exactly once across matchups and unpaired", () => {
    const participants = makeParticipants(4, 4);
    const { matchups, unpaired } = buildRandomDoublesPairing(participants);
    const used = [...allPlayerIds(matchups), ...unpaired];
    expect(used.sort()).toEqual(participants.map((p) => p.playerId).sort());
  });

  it("pairs each team from a different basket when baskets are equal", () => {
    const participants = makeParticipants(4, 4);
    const { matchups } = buildRandomDoublesPairing(participants);
    for (const matchup of [...matchups]) {
      for (const team of [matchup.sideA, matchup.sideB]) {
        const [a, b] = team.playerIds;
        const aSeeded = a.startsWith("seeded-");
        const bSeeded = b.startsWith("seeded-");
        expect(aSeeded).not.toBe(bSeeded);
      }
    }
  });

  it("produces no duplicate players", () => {
    const participants = makeParticipants(5, 3);
    const { matchups, unpaired } = buildRandomDoublesPairing(participants);
    const used = [...allPlayerIds(matchups), ...unpaired];
    expect(new Set(used).size).toBe(used.length);
  });

  it("leaves one player unpaired with an odd total", () => {
    const participants = makeParticipants(3, 2);
    const { matchups, unpaired } = buildRandomDoublesPairing(participants);
    const used = allPlayerIds(matchups).length;
    expect(used + unpaired.length).toBe(participants.length);
    expect(used % 4).toBe(0);
  });

  it("returns no matchups when fewer than 4 participants", () => {
    const participants = makeParticipants(1, 2);
    const { matchups } = buildRandomDoublesPairing(participants);
    expect(matchups).toEqual([]);
  });

  it("handles an all-seeded basket by pairing leftovers together", () => {
    const participants = makeParticipants(8, 0);
    const { matchups, unpaired } = buildRandomDoublesPairing(participants);
    expect(unpaired).toEqual([]);
    expect(matchups.length).toBe(2);
  });
});
