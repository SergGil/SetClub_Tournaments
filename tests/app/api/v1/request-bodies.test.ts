// Route-level checks for how API routes read JSON bodies through src/lib/api-body.ts: fields are
// narrowed in the route, raw shapes are forwarded to the server action (which validates them), and
// malformed bodies fall back to "not provided" instead of throwing.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  createTournamentGroupActionMock,
  createTournamentGroupWithPairsActionMock,
  toggleParticipantSeedActionMock,
  setParticipantGroupActionMock,
  removeParticipantActionMock,
  commitDoublesGroupsActionMock,
} = vi.hoisted(() => ({
  createTournamentGroupActionMock: vi.fn(),
  createTournamentGroupWithPairsActionMock: vi.fn(),
  toggleParticipantSeedActionMock: vi.fn(),
  setParticipantGroupActionMock: vi.fn(),
  removeParticipantActionMock: vi.fn(),
  commitDoublesGroupsActionMock: vi.fn(),
}));

vi.mock("@/lib/actions/tournaments", () => ({
  createTournamentGroupAction: createTournamentGroupActionMock,
  createTournamentGroupWithPairsAction: createTournamentGroupWithPairsActionMock,
  toggleParticipantSeedAction: toggleParticipantSeedActionMock,
  setParticipantGroupAction: setParticipantGroupActionMock,
  removeParticipantAction: removeParticipantActionMock,
}));
vi.mock("@/lib/actions/randomize-doubles", () => ({
  commitDoublesGroupsAction: commitDoublesGroupsActionMock,
}));

import { POST as postGroup } from "@/app/api/v1/tournaments/[id]/groups/route";
import { PATCH as patchParticipant } from "@/app/api/v1/tournaments/[id]/participants/[playerId]/route";
import { POST as postCommitGroups } from "@/app/api/v1/tournaments/[id]/randomize/doubles/commit-groups/route";

function jsonRequest(body: string): Request {
  return new Request("http://localhost/api/v1/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

const tournamentParams = { params: Promise.resolve({ id: "t1" }) };
const participantParams = { params: Promise.resolve({ id: "t1", playerId: "p1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  createTournamentGroupActionMock.mockResolvedValue({});
  createTournamentGroupWithPairsActionMock.mockResolvedValue({ matchCount: 1 });
  setParticipantGroupActionMock.mockResolvedValue(undefined);
  commitDoublesGroupsActionMock.mockResolvedValue({ matchCount: 2 });
});

describe("POST /api/v1/tournaments/[id]/groups", () => {
  it("forwards `pairs` untouched to the pairs action when it is an array", async () => {
    const pairs = [["p1", "p2"], ["p3", 4]];
    const request = jsonRequest(JSON.stringify({ name: "Група A", pairs }));

    const response = await postGroup(request, tournamentParams);

    expect(response.status).toBe(201);
    expect(createTournamentGroupWithPairsActionMock).toHaveBeenCalledWith("t1", "Група A", pairs, request);
    expect(createTournamentGroupActionMock).not.toHaveBeenCalled();
  });

  it("keeps only string player ids for a loose-player group", async () => {
    const request = jsonRequest(JSON.stringify({ name: "Група B", playerIds: ["p1", 2, null, "p2"] }));

    const response = await postGroup(request, tournamentParams);

    expect(response.status).toBe(201);
    expect(createTournamentGroupActionMock).toHaveBeenCalledWith("t1", "Група B", ["p1", "p2"], request);
  });

  it("treats invalid JSON as an empty body", async () => {
    const request = jsonRequest("{not json");

    await postGroup(request, tournamentParams);

    expect(createTournamentGroupActionMock).toHaveBeenCalledWith("t1", "", [], request);
  });
});

describe("POST /api/v1/tournaments/[id]/randomize/doubles/commit-groups", () => {
  it("forwards groupAssignment and matchups as sent, with strict boolean flags", async () => {
    const groupAssignment = { p1: 1, p2: "two" };
    const matchups = [{ sideAIds: ["p1", "p2"], sideBIds: ["p3", "p4"], group: 1 }];
    const request = jsonRequest(
      JSON.stringify({ groupAssignment, matchups, acknowledgedCompletedLoss: "yes", withPlayoff: true }),
    );

    const response = await postCommitGroups(request, tournamentParams);

    expect(response.status).toBe(200);
    expect(commitDoublesGroupsActionMock).toHaveBeenCalledWith("t1", groupAssignment, matchups, false, true, request);
  });

  it("falls back to {} and [] when the fields are missing", async () => {
    const request = jsonRequest("{}");

    await postCommitGroups(request, tournamentParams);

    expect(commitDoublesGroupsActionMock).toHaveBeenCalledWith("t1", {}, [], false, false, request);
  });
});

describe("PATCH /api/v1/tournaments/[id]/participants/[playerId]", () => {
  it("applies a boolean seed flag and a numeric group", async () => {
    const request = jsonRequest(JSON.stringify({ seeded: true, group: 2 }));

    const response = await patchParticipant(request, participantParams);

    expect(response.status).toBe(200);
    expect(toggleParticipantSeedActionMock).toHaveBeenCalledWith("t1", "p1", true, request);
    expect(setParticipantGroupActionMock).toHaveBeenCalledWith("t1", "p1", 2, request);
  });

  it("rejects a non-numeric group", async () => {
    const response = await patchParticipant(jsonRequest(JSON.stringify({ group: "2" })), participantParams);

    expect(response.status).toBe(400);
    expect(setParticipantGroupActionMock).not.toHaveBeenCalled();
  });

  it("ignores a body that isn't a JSON object instead of failing", async () => {
    // `"group" in "text"` used to throw here (a 500); a non-object body now means "nothing to change".
    const response = await patchParticipant(jsonRequest('"text"'), participantParams);

    expect(response.status).toBe(200);
    expect(toggleParticipantSeedActionMock).not.toHaveBeenCalled();
    expect(setParticipantGroupActionMock).not.toHaveBeenCalled();
  });
});
