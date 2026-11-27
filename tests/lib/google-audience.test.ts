import { describe, expect, it } from "vitest";

import { googleTokenAudiences } from "@/lib/google-audience";

describe("googleTokenAudiences", () => {
  it("is empty without AUTH_GOOGLE_ID, even when mobile ids are set - no audience must mean no sign-in", () => {
    expect(googleTokenAudiences({ AUTH_GOOGLE_MOBILE_CLIENT_IDS: "ios.apps.googleusercontent.com" })).toEqual([]);
    expect(googleTokenAudiences({ AUTH_GOOGLE_ID: "  " })).toEqual([]);
  });

  it("is just the web client when no mobile client is configured", () => {
    expect(googleTokenAudiences({ AUTH_GOOGLE_ID: "web.apps.googleusercontent.com" })).toEqual([
      "web.apps.googleusercontent.com",
    ]);
  });

  it("adds every comma-separated mobile client, trimmed, skipping empty entries", () => {
    expect(
      googleTokenAudiences({
        AUTH_GOOGLE_ID: "web.apps.googleusercontent.com",
        AUTH_GOOGLE_MOBILE_CLIENT_IDS: " android.apps.googleusercontent.com, ,ios.apps.googleusercontent.com ",
      }),
    ).toEqual([
      "web.apps.googleusercontent.com",
      "android.apps.googleusercontent.com",
      "ios.apps.googleusercontent.com",
    ]);
  });
});
