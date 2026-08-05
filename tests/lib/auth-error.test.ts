import { describe, expect, it } from "vitest";

import { authErrorMessage } from "@/lib/auth-error";

describe("authErrorMessage", () => {
  it("returns null when there is no error code", () => {
    expect(authErrorMessage(undefined)).toBeNull();
  });

  it("returns a specific message for a known error code", () => {
    expect(authErrorMessage("AccessDenied")).toBe("Доступ заборонено.");
  });

  it("falls back to a generic message for an unrecognized code", () => {
    expect(authErrorMessage("SomeFutureAuthJsError")).toBe("Не вдалося увійти. Спробуйте ще раз.");
  });
});
