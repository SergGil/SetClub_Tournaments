import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { padelMatch: { count: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { checkPadelCompletedMatchesAcknowledged } from "@/lib/actions/padel-match-randomize-shared";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkPadelCompletedMatchesAcknowledged", () => {
  it("returns null when there are no completed matches", async () => {
    prismaMock.padelMatch.count.mockResolvedValueOnce(0);
    expect(await checkPadelCompletedMatchesAcknowledged("t1", false)).toBeNull();
  });

  it("returns a warning when completed matches exist and aren't acknowledged", async () => {
    prismaMock.padelMatch.count.mockResolvedValueOnce(2);
    const message = await checkPadelCompletedMatchesAcknowledged("t1", false);
    expect(message).toContain("2 завершених");
  });

  it("returns null once acknowledged", async () => {
    prismaMock.padelMatch.count.mockResolvedValueOnce(2);
    expect(await checkPadelCompletedMatchesAcknowledged("t1", true)).toBeNull();
  });
});
