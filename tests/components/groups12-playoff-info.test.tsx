// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Groups12PlayoffInfoButton } from "@/components/groups12-playoff-info";

describe("Groups12PlayoffInfoButton", () => {
  it("opens a dialog explaining the bracket rules when clicked", async () => {
    const user = userEvent.setup();
    render(<Groups12PlayoffInfoButton />);

    expect(screen.queryByText(/Груповий етап/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Правила формату" }));

    expect(
      screen.getByRole("heading", { name: "Формат турніру: 4 групи по 3 + плей-офф" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1-ше місце групи A проти 2-го місця групи C/)).toBeInTheDocument();
  });
});
