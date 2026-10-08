// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CoffeeHeroForm } from "@/components/admin/coffee-hero-form";
import type { updateCoffeePageSettingsAction } from "@/lib/actions/coffee-settings";

const { actionMock, toastSuccessMock } = vi.hoisted(() => ({
  actionMock: vi.fn<typeof updateCoffeePageSettingsAction>(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("@/lib/actions/coffee-settings", () => ({ updateCoffeePageSettingsAction: actionMock }));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock } }));

beforeEach(() => {
  vi.clearAllMocks();
  actionMock.mockResolvedValue({ success: true });
});

describe("CoffeeHeroForm", () => {
  it("is prefilled with the current title and subtitle, with live character counters", () => {
    render(<CoffeeHeroForm heroTitle="Меню" heroSubtitle="Кава і чай" />);
    expect(screen.getByLabelText(/Заголовок/)).toHaveValue("Меню");
    expect(screen.getByLabelText(/Підзаголовок/)).toHaveValue("Кава і чай");
    expect(screen.getByText("4/60")).toBeInTheDocument();
    expect(screen.getByText("10/200")).toBeInTheDocument();
  });

  it("updates the counters as the admin types", () => {
    render(<CoffeeHeroForm heroTitle="Меню" heroSubtitle="Кава" />);
    fireEvent.change(screen.getByLabelText(/Заголовок/), { target: { value: "Кав'ярня SET" } });
    expect(screen.getByText("12/60")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Підзаголовок/), { target: { value: "Нове" } });
    expect(screen.getByText("4/200")).toBeInTheDocument();
  });

  it("submits both fields and confirms with a toast on success", async () => {
    const user = userEvent.setup();
    render(<CoffeeHeroForm heroTitle="Меню" heroSubtitle="Кава" />);
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(actionMock).toHaveBeenCalled());
    const [, formData] = actionMock.mock.calls[0];
    expect(formData.get("heroTitle")).toBe("Меню");
    expect(formData.get("heroSubtitle")).toBe("Кава");
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Заголовок сторінки збережено"));
  });

  it("shows per-field errors next to the right input and marks it invalid", async () => {
    actionMock.mockResolvedValueOnce({ error: "Вкажіть заголовок", fieldErrors: { heroTitle: "Вкажіть заголовок" } });
    const user = userEvent.setup();
    render(<CoffeeHeroForm heroTitle="Меню" heroSubtitle="Кава" />);
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    const messages = await screen.findAllByText("Вкажіть заголовок");
    expect(messages.length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Заголовок/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Підзаголовок/)).toHaveAttribute("aria-invalid", "false");
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("shows a general error without a success toast", async () => {
    actionMock.mockResolvedValueOnce({ error: "Не вдалося зберегти" });
    const user = userEvent.setup();
    render(<CoffeeHeroForm heroTitle="Меню" heroSubtitle="Кава" />);
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(await screen.findByText("Не вдалося зберегти")).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
