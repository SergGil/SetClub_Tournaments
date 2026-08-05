// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TableLoadingSkeleton } from "@/components/admin/table-loading-skeleton";

describe("TableLoadingSkeleton", () => {
  it("renders the default number of skeleton rows", () => {
    const { container } = render(<TableLoadingSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(7); // 1 title bar + 6 rows
  });

  it("renders a custom row count", () => {
    const { container } = render(<TableLoadingSkeleton rows={3} />);
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4); // 1 title bar + 3 rows
  });
});
