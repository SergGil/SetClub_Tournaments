// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomePanelForm } from "@/components/admin/home-panel-form";
import type { updateHomePanelSettingsAction } from "@/lib/actions/home-panels";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn<typeof updateHomePanelSettingsAction>(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("@/lib/actions/home-panels", () => ({ updateHomePanelSettingsAction: actionMock }));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock } }));

beforeEach(() => {
  vi.clearAllMocks();
  actionMock.mockResolvedValue({ success: true });
});

describe("HomePanelForm", () => {
  it("shows the panel's domain label and prefills the saved texts with counters", () => {
    render(<HomePanelForm panelKey="PADEL" eyebrow="Клуб" title="ПАДЕЛ" description="Корти" />);
    expect(screen.getByText("Падел")).toBeInTheDocument();
    expect(screen.getByLabelText(/Підпис над назвою/)).toHaveValue("Клуб");
    expect(screen.getByLabelText(/Велика назва/)).toHaveValue("ПАДЕЛ");
    expect(screen.getByLabelText(/Опис/)).toHaveValue("Корти");
    expect(screen.getByText("4/30")).toBeInTheDocument();
    expect(screen.getByText("5/20")).toBeInTheDocument();
    expect(screen.getByText("5/160")).toBeInTheDocument();
  });

  it("starts the optional fields empty when none are saved", () => {
    render(<HomePanelForm panelKey="TENNIS" eyebrow={null} title="ТЕНІС" description={null} />);
    expect(screen.getByLabelText(/Підпис над назвою/)).toHaveValue("");
    expect(screen.getByLabelText(/Опис/)).toHaveValue("");
    expect(screen.getByText("0/30")).toBeInTheDocument();
    expect(screen.getByText("0/160")).toBeInTheDocument();
  });

  it("uses a per-panel id prefix so the three forms on one page never share ids", () => {
    render(<HomePanelForm panelKey="COFFEE" eyebrow={null} title="КАВА" description={null} />);
    expect(screen.getByLabelText(/Велика назва/)).toHaveAttribute("id", "home-panel-coffee-title");
  });

  it("submits the hidden panel key with the edited fields and toasts the panel name", async () => {
    const user = userEvent.setup();
    render(<HomePanelForm panelKey="PADEL" eyebrow={null} title="ПАДЕЛ" description={null} />);
    fireEvent.change(screen.getByLabelText(/Велика назва/), { target: { value: "ПАДЕЛ+" } });
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(actionMock).toHaveBeenCalled());
    const [, formData] = actionMock.mock.calls[0];
    expect(formData.get("key")).toBe("PADEL");
    expect(formData.get("title")).toBe("ПАДЕЛ+");
    expect(formData.get("eyebrow")).toBe("");
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Панель «Падел» збережено"));
  });

  it("shows field errors on the matching input", async () => {
    actionMock.mockResolvedValueOnce({ error: "Вкажіть назву", fieldErrors: { title: "Вкажіть назву" } });
    const user = userEvent.setup();
    render(<HomePanelForm panelKey="TENNIS" eyebrow={null} title="ТЕНІС" description={null} />);
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    expect((await screen.findAllByText("Вкажіть назву")).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Велика назва/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Опис/)).toHaveAttribute("aria-invalid", "false");
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
