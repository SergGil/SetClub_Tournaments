// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlayerDialog } from "@/components/admin/player-dialog";
import type { createPlayerAction, updatePlayerAction } from "@/lib/actions/players";

const { createPlayerActionMock, updatePlayerActionMock } = vi.hoisted(() => ({
  createPlayerActionMock: vi.fn<typeof createPlayerAction>().mockResolvedValue({ success: true }),
  updatePlayerActionMock: vi.fn<typeof updatePlayerAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/players", () => ({
  createPlayerAction: createPlayerActionMock,
  updatePlayerAction: updatePlayerActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PlayerDialog (create mode)", () => {
  it("defaults gender to 'not specified' and requires a name", async () => {
    const user = userEvent.setup();
    render(<PlayerDialog trigger={<button>Додати гравця</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати гравця" }));

    expect(screen.getByRole("heading", { name: "Додати гравця" })).toBeInTheDocument();
    expect(document.querySelector('input[name="gender"]')).toHaveValue("");
    expect(screen.getByLabelText(/Ім'я/)).toBeRequired();
  });

  it("sets the hidden gender field once a gender is picked", async () => {
    const user = userEvent.setup();
    render(<PlayerDialog trigger={<button>Додати гравця</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати гравця" }));

    await user.click(screen.getByRole("combobox", { name: "Стать (опційно)" }));
    await user.click(await screen.findByRole("option", { name: "Чоловіча" }));

    expect(document.querySelector('input[name="gender"]')).toHaveValue("MALE");
  });

  it("shows a field error for a duplicate email without closing the dialog", async () => {
    createPlayerActionMock.mockResolvedValueOnce({
      error: "Гравець з таким email вже існує",
      fieldErrors: { email: "Такий email вже зайнятий" },
    });
    const user = userEvent.setup();
    render(<PlayerDialog trigger={<button>Додати гравця</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати гравця" }));

    await user.type(screen.getByLabelText(/Ім'я/), "Іван");
    await user.click(screen.getByRole("button", { name: "Створити" }));

    expect(await screen.findByText("Такий email вже зайнятий")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Додати гравця" })).toBeInTheDocument();
  });

  it("closes once the player is created successfully", async () => {
    const user = userEvent.setup();
    render(<PlayerDialog trigger={<button>Додати гравця</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати гравця" }));
    await user.type(screen.getByLabelText(/Ім'я/), "Іван");
    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Додати гравця" })).not.toBeInTheDocument());
  });
});

describe("PlayerDialog (edit mode)", () => {
  const player = { id: "p1", name: "Іван Петренко", email: "ivan@test.com", gender: "MALE" };

  it("pre-fills the form and posts the player id as a hidden field", async () => {
    const user = userEvent.setup();
    render(<PlayerDialog trigger={<button>Редагувати</button>} player={player} />);
    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(screen.getByRole("heading", { name: "Редагувати гравця" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ім'я/)).toHaveValue("Іван Петренко");
    expect(screen.getByLabelText("Email (опційно)")).toHaveValue("ivan@test.com");
    expect(document.querySelector('input[name="id"]')).toHaveValue("p1");
    expect(document.querySelector('input[name="gender"]')).toHaveValue("MALE");
  });
});
