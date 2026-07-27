import { describe, expect, it } from "vitest";

import { MATCH_FORMS, countLabel, pluralizeUk } from "@/lib/pluralize";

describe("pluralizeUk", () => {
  it("uses the 'one' form for 1, 21, 31...", () => {
    expect(pluralizeUk(1, MATCH_FORMS)).toBe("матч");
    expect(pluralizeUk(21, MATCH_FORMS)).toBe("матч");
    expect(pluralizeUk(101, MATCH_FORMS)).toBe("матч");
  });

  it("uses the 'few' form for 2-4, 22-24...", () => {
    expect(pluralizeUk(2, MATCH_FORMS)).toBe("матчі");
    expect(pluralizeUk(3, MATCH_FORMS)).toBe("матчі");
    expect(pluralizeUk(4, MATCH_FORMS)).toBe("матчі");
    expect(pluralizeUk(22, MATCH_FORMS)).toBe("матчі");
  });

  it("uses the 'many' form for 0, 5-20, 25...", () => {
    expect(pluralizeUk(0, MATCH_FORMS)).toBe("матчів");
    expect(pluralizeUk(5, MATCH_FORMS)).toBe("матчів");
    expect(pluralizeUk(11, MATCH_FORMS)).toBe("матчів");
    expect(pluralizeUk(12, MATCH_FORMS)).toBe("матчів");
    expect(pluralizeUk(14, MATCH_FORMS)).toBe("матчів");
    expect(pluralizeUk(20, MATCH_FORMS)).toBe("матчів");
    expect(pluralizeUk(25, MATCH_FORMS)).toBe("матчів");
  });
});

describe("countLabel", () => {
  it("combines the count with the correct form", () => {
    expect(countLabel(1, MATCH_FORMS)).toBe("1 матч");
    expect(countLabel(2, MATCH_FORMS)).toBe("2 матчі");
    expect(countLabel(5, MATCH_FORMS)).toBe("5 матчів");
  });
});
