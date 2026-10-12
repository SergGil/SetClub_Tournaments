// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("keeps the typed text when the server rejects the submit", async () => {
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

    await screen.findByText("Вкажіть заголовок");
    expect(screen.getByLabelText(/Заголовок/)).toHaveValue("Х");
    expect(screen.getByLabelText(/Текст/)).toHaveValue("Текст новини");
  });
});

describe("NewsDialog (leave confirmation)", () => {
  const heading = () => screen.queryByRole("heading", { name: "Додати новину" });
  const confirmTitle = () => screen.queryByText("Покинути без збереження?");
  // While the confirmation is up, Base UI hides the dialog underneath from the
  // accessibility tree - it's still mounted, just not reachable by plain role.
  const underlyingHeading = () => screen.queryByRole("heading", { name: "Додати новину", hidden: true });

  async function openDialog() {
    const user = userEvent.setup();
    render(<NewsDialog trigger={<button>Додати новину</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати новину" }));
    return user;
  }

  it("closes straight away when nothing was typed", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(heading()).not.toBeInTheDocument());
    expect(confirmTitle()).not.toBeInTheDocument();
  });

  it("asks before closing via the X when there is a typed title", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText(/Заголовок/), "Чернетка");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(await screen.findByText("Покинути без збереження?")).toBeInTheDocument();
    expect(underlyingHeading()).toBeInTheDocument();
  });

  it("asks before closing via Escape when there is typed body text", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText(/Текст/), "Чернетка");
    await user.keyboard("{Escape}");

    expect(await screen.findByText("Покинути без збереження?")).toBeInTheDocument();
    expect(underlyingHeading()).toBeInTheDocument();
  });

  it("keeps the dialog and the draft when the admin chooses to stay", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText(/Заголовок/), "Чернетка");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: "Залишитись" }));

    await waitFor(() => expect(confirmTitle()).not.toBeInTheDocument());
    expect(heading()).toBeInTheDocument();
    expect(screen.getByLabelText(/Заголовок/)).toHaveValue("Чернетка");
  });

  it("closes and discards the draft when the admin confirms leaving", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText(/Заголовок/), "Чернетка");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: "Покинути" }));

    await waitFor(() => expect(heading()).not.toBeInTheDocument());

    // Reopening gives a clean form and no stale confirmation.
    await user.click(screen.getByRole("button", { name: "Додати новину" }));
    expect(screen.getByLabelText(/Заголовок/)).toHaveValue("");
    expect(confirmTitle()).not.toBeInTheDocument();
  });
});

describe("NewsDialog (photo counts as part of the draft)", () => {
  const confirmTitle = () => screen.queryByText("Покинути без збереження?");
  const jpeg = () => new File(["fake-image-bytes"], "photo.jpg", { type: "image/jpeg" });
  const addNewsHeading = () => screen.queryByRole("heading", { name: "Додати новину" });
  const editNewsHeading = () => screen.queryByRole("heading", { name: "Редагувати новину" });

  beforeEach(() => {
    // jsdom has neither - the photo field calls them once an upload completes
    // (preview) and when the preview is dropped.
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Presign + PUT both succeed, unless `presign` is overridden. */
  function stubUpload(presign?: () => Promise<Response>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/news/photo-presign") {
          return (
            presign?.() ??
            ({
              ok: true,
              json: async () => ({ uploadUrl: "https://r2.example.com/upload", key: "news/abc-photo.jpg" }),
            } as Response)
          );
        }
        if (url === "https://r2.example.com/upload") return { ok: true, json: async () => ({}) } as Response;
        throw new Error(`unexpected fetch to ${url}`);
      }),
    );
  }

  async function openCreate() {
    const user = userEvent.setup();
    render(<NewsDialog trigger={<button>Додати новину</button>} />);
    await user.click(screen.getByRole("button", { name: "Додати новину" }));
    return user;
  }

  it("asks before closing when only a photo was picked (no text typed)", async () => {
    stubUpload();
    const user = await openCreate();
    await user.upload(screen.getByLabelText("Фото"), jpeg());
    await screen.findByRole("button", { name: /Прибрати фото/ });
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(await screen.findByText("Покинути без збереження?")).toBeInTheDocument();
    expect(screen.getByText("Введені дані буде втрачено.")).toBeInTheDocument();
  });

  it("closes without asking once the only picked photo is removed again", async () => {
    stubUpload();
    const user = await openCreate();
    await user.upload(screen.getByLabelText("Фото"), jpeg());
    await user.click(await screen.findByRole("button", { name: /Прибрати фото/ }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(addNewsHeading()).not.toBeInTheDocument());
    expect(confirmTitle()).not.toBeInTheDocument();
  });

  it("asks when closing while the picked photo is still uploading", async () => {
    stubUpload(() => new Promise<Response>(() => {}));
    const user = await openCreate();
    await user.upload(screen.getByLabelText("Фото"), jpeg());
    await screen.findByText("Завантаження…");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(await screen.findByText("Покинути без збереження?")).toBeInTheDocument();
  });

  it("does not count a photo whose upload failed", async () => {
    stubUpload(async () => ({ ok: false, json: async () => ({ error: "Forbidden" }) }) as Response);
    const user = await openCreate();
    await user.upload(screen.getByLabelText("Фото"), jpeg());
    await screen.findByText("Forbidden");
    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(addNewsHeading()).not.toBeInTheDocument());
    expect(confirmTitle()).not.toBeInTheDocument();
  });

  it("a reopened dialog starts without the previous photo draft", async () => {
    stubUpload();
    const user = await openCreate();
    await user.upload(screen.getByLabelText("Фото"), jpeg());
    await screen.findByRole("button", { name: /Прибрати фото/ });
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: "Покинути" }));
    await waitFor(() => expect(addNewsHeading()).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Додати новину" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(addNewsHeading()).not.toBeInTheDocument());
    expect(confirmTitle()).not.toBeInTheDocument();
  });

  describe("edit mode with a saved photo", () => {
    const post = { id: "n1", title: "Стара новина", body: "Старий текст", photoUrl: "https://r2.example.com/news/old.jpg" };

    it("closes without asking while the saved photo is untouched", async () => {
      const user = userEvent.setup();
      render(<NewsDialog trigger={<button>Редагувати</button>} post={post} />);
      await user.click(screen.getByRole("button", { name: "Редагувати" }));
      await user.click(screen.getByRole("button", { name: "Close" }));

      await waitFor(() => expect(editNewsHeading()).not.toBeInTheDocument());
      expect(confirmTitle()).not.toBeInTheDocument();
    });

    it("asks once the saved photo has been removed", async () => {
      const user = userEvent.setup();
      render(<NewsDialog trigger={<button>Редагувати</button>} post={post} />);
      await user.click(screen.getByRole("button", { name: "Редагувати" }));
      await user.click(screen.getByRole("button", { name: /Прибрати фото/ }));
      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByText("Покинути без збереження?")).toBeInTheDocument();
      expect(screen.getByText("Внесені зміни буде втрачено.")).toBeInTheDocument();
    });

    it("asks once the saved photo has been replaced", async () => {
      stubUpload();
      const user = userEvent.setup();
      render(<NewsDialog trigger={<button>Редагувати</button>} post={post} />);
      await user.click(screen.getByRole("button", { name: "Редагувати" }));
      await user.upload(screen.getByLabelText("Фото"), jpeg());
      await waitFor(() => expect(document.querySelector('input[name="photoKey"]')).toHaveValue("news/abc-photo.jpg"));
      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByText("Покинути без збереження?")).toBeInTheDocument();
    });
  });
});

describe("NewsDialog (edit mode)", () => {
  const post = { id: "n1", title: "Стара новина", body: "Старий текст" };

  it("closes without asking when nothing was changed", async () => {
    const user = userEvent.setup();
    render(<NewsDialog trigger={<button>Редагувати</button>} post={post} />);
    await user.click(screen.getByRole("button", { name: "Редагувати" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Редагувати новину" })).not.toBeInTheDocument());
    expect(screen.queryByText("Покинути без збереження?")).not.toBeInTheDocument();
  });

  it("treats a typed-and-reverted edit as unchanged when the saved body has CRLF line breaks", async () => {
    // Bodies saved through a form post come back with "\r\n"; a textarea
    // reports "\n", so comparing them raw made this look like a real change.
    const user = userEvent.setup();
    render(
      <NewsDialog trigger={<button>Редагувати</button>} post={{ id: "n2", title: "Новина", body: "Рядок 1\r\nРядок 2" }} />,
    );
    await user.click(screen.getByRole("button", { name: "Редагувати" }));
    expect(screen.getByText("15/5000")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Текст/), "x");
    await user.keyboard("{Backspace}");
    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Редагувати новину" })).not.toBeInTheDocument());
    expect(screen.queryByText("Покинути без збереження?")).not.toBeInTheDocument();
  });

  it("asks before closing once the text differs from the saved post", async () => {
    const user = userEvent.setup();
    render(<NewsDialog trigger={<button>Редагувати</button>} post={post} />);
    await user.click(screen.getByRole("button", { name: "Редагувати" }));
    await user.type(screen.getByLabelText(/Текст/), " + правка");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(await screen.findByText("Покинути без збереження?")).toBeInTheDocument();
    expect(screen.getByText("Внесені зміни буде втрачено.")).toBeInTheDocument();
  });

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
