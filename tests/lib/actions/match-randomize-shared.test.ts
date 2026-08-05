import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { match: { count: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { checkCompletedMatchesAcknowledged } from "@/lib/actions/match-randomize-shared";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkCompletedMatchesAcknowledged", () => {
  it("returns null when there are no completed matches", async () => {
    prismaMock.match.count.mockResolvedValueOnce(0);
    expect(await checkCompletedMatchesAcknowledged("t1", false)).toBeNull();
  });

  it("returns a warning when completed matches exist and aren't acknowledged", async () => {
    prismaMock.match.count.mockResolvedValueOnce(2);
    const message = await checkCompletedMatchesAcknowledged("t1", false);
    expect(message).toContain("2 завершених");
  });

  it("returns null once acknowledged", async () => {
    prismaMock.match.count.mockResolvedValueOnce(2);
    expect(await checkCompletedMatchesAcknowledged("t1", true)).toBeNull();
  });
});
