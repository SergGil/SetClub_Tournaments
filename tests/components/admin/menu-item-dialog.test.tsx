// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MenuItemDialog } from "@/components/admin/menu-item-dialog";
import type { createMenuItemAction, updateMenuItemAction } from "@/lib/actions/menu";

const { createMenuItemActionMock, updateMenuItemActionMock } = vi.hoisted(() => ({
  createMenuItemActionMock: vi.fn<typeof createMenuItemAction>().mockResolvedValue({ success: true }),
  updateMenuItemActionMock: vi.fn<typeof updateMenuItemAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/menu", () => ({
  createMenuItemAction: createMenuItemActionMock,
  updateMenuItemAction: updateMenuItemActionMock,
}));

const sections = [
  { id: "s1", name: "Кава" },
  { id: "s2", name: "Чай" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MenuItemDialog (create mode)", () => {
  it("defaults the section to defaultSectionId when given", async () => {
    const user = userEvent.setup();
    render(<MenuItemDialog trigger={<button>Додати напій</button>} sections={sections} defaultSectionId="s2" />);
    await user.click(screen.getByRole("button", { name: "Додати напій" }));

    expect(screen.getByRole("combobox", { name: /Секція/ })).toHaveTextContent("Чай");
  });

  it("shows field errors without closing the dialog", async () => {
    createMenuItemActionMock.mockResolvedValueOnce({
      error: "Некоректні дані",
      fieldErrors: { name: "Вкажіть назву напою" },
    });
    const user = userEvent.setup();
    render(<MenuItemDialog trigger={<button>Додати напій</button>} sections={sections} />);
    await user.click(screen.getByRole("button", { name: "Додати напій" }));

    // Both name and price are HTML5-required, so they need *some* value to
    // reach the (mocked) server action at all - the field error below comes
    // from the mocked response, not from skipping this.
    await user.type(screen.getByLabelText(/Назва/), "Х");
    await user.type(screen.getByLabelText("Ціна, грн *"), "95");
    await user.click(screen.getByRole("button", { name: "Додати" }));

    expect(await screen.findByText("Вкажіть назву напою")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Додати напій" })).toBeInTheDocument();
  });

  it("submits the picked section, name, price and description", async () => {
    const user = userEvent.setup();
    render(<MenuItemDialog trigger={<button>Додати напій</button>} sections={sections} defaultSectionId="s1" />);
    await user.click(screen.getByRole("button", { name: "Додати напій" }));

    await user.click(screen.getByRole("combobox", { name: /Секція/ }));
    await user.click(await screen.findByRole("option", { name: "Чай" }));
    await user.type(screen.getByLabelText(/Назва/), "Матча латте");
    await user.type(screen.getByLabelText("Ціна, грн *"), "110");
    await user.type(screen.getByLabelText("Опис (опційно)"), "з кокосовим молоком");
    await user.click(screen.getByRole("button", { name: "Додати" }));

    await waitFor(() => expect(createMenuItemActionMock).toHaveBeenCalled());
    const [, formData] = createMenuItemActionMock.mock.calls[0];
    expect(formData.get("sectionId")).toBe("s2");
    expect(formData.get("name")).toBe("Матча латте");
    expect(formData.get("price")).toBe("110");
    expect(formData.get("description")).toBe("з кокосовим молоком");
  });

  it("closes once the item is created successfully", async () => {
    const user = userEvent.setup();
    render(<MenuItemDialog trigger={<button>Додати напій</button>} sections={sections} defaultSectionId="s1" />);
    await user.click(screen.getByRole("button", { name: "Додати напій" }));
    await user.type(screen.getByLabelText(/Назва/), "Латте");
    await user.type(screen.getByLabelText("Ціна, грн *"), "95");
    await user.click(screen.getByRole("button", { name: "Додати" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Додати напій" })).not.toBeInTheDocument());
  });
});

describe("MenuItemDialog (edit mode)", () => {
  const item = {
    id: "i1",
    sectionId: "s1",
    name: "Латте",
    price: 95,
    description: "вершковий смак",
    sortOrder: 0,
  };

  it("pre-fills the form and posts the item id as a hidden field", async () => {
    const user = userEvent.setup();
    render(<MenuItemDialog trigger={<button>Редагувати</button>} sections={sections} item={item} />);
    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(screen.getByRole("heading", { name: "Редагувати напій" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Назва/)).toHaveValue("Латте");
    expect(screen.getByLabelText("Ціна, грн *")).toHaveValue(95);
    expect(screen.getByLabelText("Опис (опційно)")).toHaveValue("вершковий смак");
    expect(screen.getByRole("combobox", { name: /Секція/ })).toHaveTextContent("Кава");
    expect(document.querySelector('input[name="id"]')).toHaveValue("i1");
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeInTheDocument();
  });

  it("shows the existing photo, when the item has one", async () => {
    const user = userEvent.setup();
    render(
      <MenuItemDialog
        trigger={<button>Редагувати</button>}
        sections={sections}
        item={{ ...item, photoUrl: "https://r2.example.com/menu/latte.jpg" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(document.querySelector("img")).toHaveAttribute("src", "https://r2.example.com/menu/latte.jpg");
  });

  it("submits the existing id together with the updated section", async () => {
    const user = userEvent.setup();
    render(<MenuItemDialog trigger={<button>Редагувати</button>} sections={sections} item={item} />);
    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    await user.click(screen.getByRole("combobox", { name: /Секція/ }));
    await user.click(await screen.findByRole("option", { name: "Чай" }));
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateMenuItemActionMock).toHaveBeenCalled());
    const [, formData] = updateMenuItemActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("i1");
    expect(formData.get("sectionId")).toBe("s2");
  });
});
