// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PillFilterGroup, PillFilterLink } from "@/components/pill-filter";

describe("PillFilterLink", () => {
  it("links to the given href regardless of active state", () => {
    render(
      <PillFilterGroup>
        <PillFilterLink href="/matches?status=ALL" active={false}>
          Усі
        </PillFilterLink>
        <PillFilterLink href="/matches?status=COMPLETED" active={true}>
          Завершені
        </PillFilterLink>
      </PillFilterGroup>,
    );
    expect(screen.getByRole("link", { name: "Усі" })).toHaveAttribute("href", "/matches?status=ALL");
    expect(screen.getByRole("link", { name: "Завершені" })).toHaveAttribute(
      "href",
      "/matches?status=COMPLETED",
    );
  });
});
