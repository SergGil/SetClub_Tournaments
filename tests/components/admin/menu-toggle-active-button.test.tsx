// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MenuToggleActiveButton } from "@/components/admin/menu-toggle-active-button";
import type { ActionState } from "@/lib/actions/menu";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MenuToggleActiveButton", () => {
  it("submits active=false to hide a currently active section/item", async () => {
    const action = vi.fn<(state: ActionState, formData: FormData) => Promise<ActionState>>()
      .mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<MenuToggleActiveButton id="sec1" active={true} action={action} />);

    expect(screen.getByRole("button", { name: "Приховати" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Приховати" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const [, formData] = action.mock.calls[0];
    expect(formData.get("id")).toBe("sec1");
    expect(formData.get("active")).toBe("false");
  });

  it("submits active=true to show a currently hidden section/item", async () => {
    const action = vi.fn<(state: ActionState, formData: FormData) => Promise<ActionState>>()
      .mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<MenuToggleActiveButton id="i1" active={false} action={action} />);

    expect(screen.getByRole("button", { name: "Показати" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Показати" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const [, formData] = action.mock.calls[0];
    expect(formData.get("id")).toBe("i1");
    expect(formData.get("active")).toBe("true");
  });
});
