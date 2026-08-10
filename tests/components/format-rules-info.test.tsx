// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FormatRulesButton } from "@/components/format-rules-info";

describe("FormatRulesButton", () => {
  it("explains the GROUPS_12_PLAYOFF bracket rules", async () => {
    const user = userEvent.setup();
    render(<FormatRulesButton kind="GROUPS_12_PLAYOFF" format="SINGLES" />);

    expect(screen.queryByText(/Груповий етап/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Правила формату" }));

    expect(
      screen.getByRole("heading", { name: "Формат турніру: 4 групи по 3 + плей-офф" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1-ше місце групи A проти 2-го місця групи C/)).toBeInTheDocument();
  });

  it("explains the За групами rules with singles wording", async () => {
    const user = userEvent.setup();
    render(<FormatRulesButton kind="CUSTOM_GROUPS" format="SINGLES" />);

    await user.click(screen.getByRole("button", { name: "Правила формату" }));

    expect(screen.getByRole("heading", { name: "Формат турніру: За групами" })).toBeInTheDocument();
    expect(screen.getByText(/кожен гравець грає з кожним іншим/)).toBeInTheDocument();
  });

  it("explains the За групами rules with doubles (pair) wording", async () => {
    const user = userEvent.setup();
    render(<FormatRulesButton kind="CUSTOM_GROUPS" format="DOUBLES" />);

    await user.click(screen.getByRole("button", { name: "Правила формату" }));

    expect(screen.getByRole("heading", { name: "Формат турніру: За групами" })).toBeInTheDocument();
    expect(screen.getByText(/кожна пара грає з кожною іншою парою тієї ж групи/)).toBeInTheDocument();
    expect(screen.queryByText(/кожен гравець грає/)).not.toBeInTheDocument();
  });

  it("explains the За сіяністю (seeded split) rules", async () => {
    const user = userEvent.setup();
    render(<FormatRulesButton kind="SEEDED_SPLIT" format="SINGLES" />);

    await user.click(screen.getByRole("button", { name: "Правила формату" }));

    expect(screen.getByRole("heading", { name: "Формат турніру: За сіяністю" })).toBeInTheDocument();
    expect(screen.getByText(/«сіяних»/)).toBeInTheDocument();
    expect(screen.getByText(/«несіяних»/)).toBeInTheDocument();
  });
});
