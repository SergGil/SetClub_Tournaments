import { describe, expect, it } from "vitest";

import { checkedByAction, readJsonBody, stringArray, unknownArray } from "@/lib/api-body";

function jsonRequest(body: string): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("readJsonBody", () => {
  it("returns a JSON object body as-is", async () => {
    expect(await readJsonBody(jsonRequest('{"name":"Група A","pairs":[["a","b"]]}'))).toEqual({
      name: "Група A",
      pairs: [["a", "b"]],
    });
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["an empty body", ""],
    ["null", "null"],
    ["an array", '["a","b"]'],
    ["a string", '"hello"'],
    ["a number", "42"],
  ])("turns %s into an empty object", async (_label, raw) => {
    expect(await readJsonBody(jsonRequest(raw))).toEqual({});
  });
});

describe("unknownArray", () => {
  it("returns arrays unchanged and anything else as []", () => {
    expect(unknownArray([1, "a", null])).toEqual([1, "a", null]);
    expect(unknownArray("abc")).toEqual([]);
    expect(unknownArray({ 0: "a", length: 1 })).toEqual([]);
    expect(unknownArray(undefined)).toEqual([]);
  });
});

describe("stringArray", () => {
  it("keeps only the string elements of an array", () => {
    expect(stringArray(["p1", 2, null, "p2", { id: "p3" }])).toEqual(["p1", "p2"]);
  });

  it("returns [] for a non-array", () => {
    expect(stringArray("p1")).toEqual([]);
    expect(stringArray(undefined)).toEqual([]);
  });
});

describe("checkedByAction", () => {
  it("passes the value through untouched", () => {
    const value = { anything: [1, 2] };
    expect(checkedByAction(value)).toBe(value);
  });
});
