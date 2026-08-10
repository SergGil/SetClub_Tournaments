// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewsDialog } from "@/components/admin/news-dialog";
import type { createNewsPostAction, updateNewsPostAction } from "@/lib/actions/news";

const { createNewsPostActionMock, updateNewsPostActionMock } = vi.hoisted(() => ({
  createNewsPostActionMock: vi.fn<typeof createNewsPostAction>().mockResolvedValue({ success: true }),
  updateNewsPostActionMock: vi.fn<typeof updateNewsPostAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/news", () => ({
  createNewsPostAction: createNewsPostActionMock,
  updateNewsPostAction: updateNewsPostActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NewsDialog (create mode)", () => {
  it("updates the title/body character counters as the admin types", async () => {
    const user = userEvent.setup();
    render(<NewsDialog trigger={<button>Додати новину</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати новину" }));

    await user.type(screen.getByLabelText(/Заголовок/), "Новини");
    expect(screen.getByText("6/150")).toBeInTheDocument();
  });

  it("shows field errors without closing the dialog", async () => {
    createNewsPostActionMock.mockResolvedValueOnce({
      error: "Некоректні дані",
      fieldErrors: { title: "Вкажіть заголовок" },
    });
    const user = userEvent.setup();
    render(<NewsDialog trigger={<button>Додати новину</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати новину" }));

    await user.type(screen.getByLabelText(/Заголовок/), "Х");
    await user.type(screen.getByLabelText(/Текст/), "Текст новини");
    await user.click(screen.getByRole("button", { name: "Опублікувати" }));

    expect(await screen.findByText("Вкажіть заголовок")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Додати новину" })).toBeInTheDocument();
  });

  it("closes once the post is published successfully", async () => {
    const user = userEvent.setup();
    render(<NewsDialog trigger={<button>Додати новину</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати новину" }));
    await user.type(screen.getByLabelText(/Заголовок/), "Новини клубу");
    await user.type(screen.getByLabelText(/Текст/), "Текст новини");
    await user.click(screen.getByRole("button", { name: "Опублікувати" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Додати новину" })).not.toBeInTheDocument());
  });
});

describe("NewsDialog (edit mode)", () => {
  const post = { id: "n1", title: "Стара новина", body: "Старий текст" };

  it("pre-fills the form and posts the post id as a hidden field", async () => {
    const user = userEvent.setup();
    render(<NewsDialog trigger={<button>Редагувати</button>} post={post} />);
    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(screen.getByRole("heading", { name: "Редагувати новину" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Заголовок/)).toHaveValue("Стара новина");
    expect(screen.getByLabelText(/Текст/)).toHaveValue("Старий текст");
    expect(document.querySelector('input[name="id"]')).toHaveValue("n1");
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeInTheDocument();
  });

  it("shows the existing cover photo, when the post has one", async () => {
    const user = userEvent.setup();
    render(
      <NewsDialog
        trigger={<button>Редагувати</button>}
        post={{ ...post, photoUrl: "https://r2.example.com/news/old.jpg" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(document.querySelector("img")).toHaveAttribute("src", "https://r2.example.com/news/old.jpg");
  });
});
