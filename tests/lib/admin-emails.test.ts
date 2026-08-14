import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getProtectedAdminEmails, isProtectedAdminEmail } from "@/lib/admin-emails";

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL_ADMIN_EMAILS === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
});

describe("getProtectedAdminEmails", () => {
  it("returns an empty list when ADMIN_EMAILS isn't set", () => {
    delete process.env.ADMIN_EMAILS;
    expect(getProtectedAdminEmails()).toEqual([]);
  });

  it("returns an empty list for an empty string", () => {
    process.env.ADMIN_EMAILS = "";
    expect(getProtectedAdminEmails()).toEqual([]);
  });

  it("lowercases a single email", () => {
    process.env.ADMIN_EMAILS = "Owner@Example.com";
    expect(getProtectedAdminEmails()).toEqual(["owner@example.com"]);
  });

  it("splits and trims a comma-separated list, ignoring stray whitespace", () => {
    process.env.ADMIN_EMAILS = " one@example.com,  Two@Example.com ,three@example.com";
    expect(getProtectedAdminEmails()).toEqual(["one@example.com", "two@example.com", "three@example.com"]);
  });

  it("drops empty entries from a trailing/doubled comma", () => {
    process.env.ADMIN_EMAILS = "one@example.com,,two@example.com,";
    expect(getProtectedAdminEmails()).toEqual(["one@example.com", "two@example.com"]);
  });
});

describe("isProtectedAdminEmail", () => {
  it("matches case-insensitively", () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    expect(isProtectedAdminEmail("Owner@Example.com")).toBe(true);
  });

  it("returns false for an email not on the list", () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    expect(isProtectedAdminEmail("someone-else@example.com")).toBe(false);
  });

  it("returns false when no protected emails are configured", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isProtectedAdminEmail("owner@example.com")).toBe(false);
  });
});
