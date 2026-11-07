// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditLogTable, type AuditLogRow } from "@/components/admin/audit-log-table";

const { deleteAuditLogEntriesActionMock } = vi.hoisted(() => ({
  deleteAuditLogEntriesActionMock: vi.fn(async (ids: string[]) => ids.length),
}));
vi.mock("@/lib/actions/audit", () => ({ deleteAuditLogEntriesAction: deleteAuditLogEntriesActionMock }));

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock } }));

function row(id: string, summary: string): AuditLogRow {
  return { id, createdAtLabel: "01.11.2026, 12:00", actorLabel: "Admin", actionLabel: "Матч створено", summary };
}

const ROWS = [row("a1", "Перший"), row("a2", "Другий"), row("a3", "Третій")];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuditLogTable", () => {
  it("keeps the delete button disabled until something is selected", () => {
    render(<AuditLogTable rows={ROWS} />);
    expect(screen.getByRole("button", { name: "Видалити вибрані" })).toBeDisabled();
  });

  it("deletes the picked entries only after confirming", async () => {
    const user = userEvent.setup();
    render(<AuditLogTable rows={ROWS} />);
    await user.click(screen.getByRole("checkbox", { name: "Вибрати запис: Другий" }));
    expect(screen.getByText("Вибрано: 1 запис")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Видалити вибрані" }));
    await screen.findByRole("alertdialog");
    expect(screen.getByText("Видалити 1 запис з журналу?")).toBeInTheDocument();
    expect(deleteAuditLogEntriesActionMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Видалити" }));
    await waitFor(() => expect(deleteAuditLogEntriesActionMock).toHaveBeenCalledWith(["a2"]));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Видалено 1 запис"));
  });

  it("select-all picks every entry on the page", async () => {
    const user = userEvent.setup();
    render(<AuditLogTable rows={ROWS} />);
    await user.click(screen.getByRole("checkbox", { name: "Вибрати всі записи на сторінці" }));
    expect(screen.getByText("Вибрано: 3 записи")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Видалити вибрані" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Видалити" }));
    await waitFor(() => expect(deleteAuditLogEntriesActionMock).toHaveBeenCalledWith(["a1", "a2", "a3"]));
  });

  it("cancelling the confirmation deletes nothing", async () => {
    const user = userEvent.setup();
    render(<AuditLogTable rows={ROWS} />);
    await user.click(screen.getByRole("checkbox", { name: "Вибрати запис: Перший" }));
    await user.click(screen.getByRole("button", { name: "Видалити вибрані" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Скасувати" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(deleteAuditLogEntriesActionMock).not.toHaveBeenCalled();
  });

  it("forgets selected ids that are no longer on the page", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AuditLogTable rows={ROWS} />);
    await user.click(screen.getByRole("checkbox", { name: "Вибрати запис: Перший" }));
    rerender(<AuditLogTable rows={[row("a2", "Другий")]} />);

    expect(screen.getByRole("button", { name: "Видалити вибрані" })).toBeDisabled();
  });

  it("shows the server's message when the delete fails", async () => {
    deleteAuditLogEntriesActionMock.mockRejectedValueOnce(new Error("Forbidden: admin access required"));
    const user = userEvent.setup();
    render(<AuditLogTable rows={ROWS} />);
    await user.click(screen.getByRole("checkbox", { name: "Вибрати запис: Перший" }));
    await user.click(screen.getByRole("button", { name: "Видалити вибрані" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Forbidden: admin access required"));
  });
});
