// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MenuSectionDialog } from "@/components/admin/menu-section-dialog";
import type { createMenuSectionAction, updateMenuSectionAction } from "@/lib/actions/menu";

const { createMenuSectionActionMock, updateMenuSectionActionMock } = vi.hoisted(() => ({
  createMenuSectionActionMock: vi.fn<typeof createMenuSectionAction>().mockResolvedValue({ success: true }),
  updateMenuSectionActionMock: vi.fn<typeof updateMenuSectionAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/menu", () => ({
  createMenuSectionAction: createMenuSectionActionMock,
  updateMenuSectionAction: updateMenuSectionActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MenuSectionDialog (create mode)", () => {
  it("defaults to the LIST layout", async () => {
    const user = userEvent.setup();
    render(<MenuSectionDialog trigger={<button>Додати секцію</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати секцію" }));

    expect(screen.getByRole("combobox", { name: /Вигляд/ })).toHaveTextContent("Список (назва — ціна)");
  });

  it("submits the picked layout as a hidden field", async () => {
    const user = userEvent.setup();
    render(<MenuSectionDialog trigger={<button>Додати секцію</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати секцію" }));

    await user.type(screen.getByLabelText(/Назва/), "Special Menu");
    await user.click(screen.getByRole("combobox", { name: /Вигляд/ }));
    await user.click(await screen.findByRole("option", { name: "Картки (фото + опис)" }));
    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(createMenuSectionActionMock).toHaveBeenCalled());
    const [, formData] = createMenuSectionActionMock.mock.calls[0];
    expect(formData.get("layout")).toBe("CARDS");
    expect(formData.get("name")).toBe("Special Menu");
  });

  it("shows field errors without closing the dialog", async () => {
    createMenuSectionActionMock.mockResolvedValueOnce({
      error: "Некоректні дані",
      fieldErrors: { name: "Вкажіть назву секції" },
    });
    const user = userEvent.setup();
    render(<MenuSectionDialog trigger={<button>Додати секцію</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати секцію" }));
    // The name input is HTML5-required, so it needs *some* value to reach the
    // (mocked) server action at all - the field error below comes from the
    // mocked response, not from skipping this.
    await user.type(screen.getByLabelText(/Назва/), "Х");
    await user.click(screen.getByRole("button", { name: "Створити" }));

    expect(await screen.findByText("Вкажіть назву секції")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Додати секцію" })).toBeInTheDocument();
  });

  it("closes once the section is created successfully", async () => {
    const user = userEvent.setup();
    render(<MenuSectionDialog trigger={<button>Додати секцію</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати секцію" }));
    await user.type(screen.getByLabelText(/Назва/), "Кава");
    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Додати секцію" })).not.toBeInTheDocument());
  });
});

describe("MenuSectionDialog (edit mode)", () => {
  const section = { id: "sec1", name: "Кава", tagline: "гарячі напої", layout: "LIST", sortOrder: 10 };

  it("pre-fills the form and posts the section id as a hidden field", async () => {
    const user = userEvent.setup();
    render(<MenuSectionDialog trigger={<button>Редагувати</button>} section={section} />);
    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(screen.getByRole("heading", { name: "Редагувати секцію" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Назва/)).toHaveValue("Кава");
    expect(screen.getByLabelText("Підзаголовок (опційно)")).toHaveValue("гарячі напої");
    expect(document.querySelector('input[name="id"]')).toHaveValue("sec1");
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeInTheDocument();
  });

  it("submits the existing id together with the updated layout", async () => {
    const user = userEvent.setup();
    render(<MenuSectionDialog trigger={<button>Редагувати</button>} section={section} />);
    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    await user.click(screen.getByRole("combobox", { name: /Вигляд/ }));
    await user.click(await screen.findByRole("option", { name: "Картки (фото + опис)" }));
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateMenuSectionActionMock).toHaveBeenCalled());
    const [, formData] = updateMenuSectionActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("sec1");
    expect(formData.get("layout")).toBe("CARDS");
  });
});
