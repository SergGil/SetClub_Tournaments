// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PadelTournamentPhotos } from "@/components/admin/padel-tournament-photos";

const { deleteActionMock, confirmActionMock, setCoverActionMock } = vi.hoisted(() => ({
  deleteActionMock: vi.fn(),
  confirmActionMock: vi.fn(),
  setCoverActionMock: vi.fn(),
}));
vi.mock("@/lib/actions/padel-photos", () => ({
  deletePadelPhotoAction: deleteActionMock,
  confirmPadelPhotoUploadAction: confirmActionMock,
  setPadelTournamentCoverPhotoAction: setCoverActionMock,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const photos = [
  { id: "p1", url: "https://pub-test.r2.dev/p1.jpg", caption: "Фінал" },
  { id: "p2", url: "https://pub-test.r2.dev/p2.jpg", caption: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PadelTournamentPhotos", () => {
  it("offers the upload button and an empty-state message when the tournament has no photos", () => {
    render(<PadelTournamentPhotos tournamentId="t1" photos={[]} />);
    expect(screen.getByRole("button", { name: "Додати фото" })).toBeInTheDocument();
    expect(screen.getByText("Фото ще немає.")).toBeInTheDocument();
  });

  it("shows the upload button next to the photo grid, one thumbnail per photo", () => {
    render(<PadelTournamentPhotos tournamentId="t1" photos={photos} />);
    expect(screen.getByRole("button", { name: "Додати фото" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Фінал" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Фото турніру" })).toBeInTheDocument();
    expect(screen.queryByText("Фото ще немає.")).not.toBeInTheDocument();
  });

  it("lets the admin delete from the lightbox (delete is enabled without any extra flag)", async () => {
    deleteActionMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<PadelTournamentPhotos tournamentId="t1" photos={photos} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Видалити фото" }));
    await user.click(await screen.findByRole("button", { name: "Видалити" }));

    expect(deleteActionMock).toHaveBeenCalledWith("p1");
  });

  it("lets the admin make a photo the tournament cover, and marks the current cover", async () => {
    setCoverActionMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <PadelTournamentPhotos
        tournamentId="t1"
        photos={[
          { ...photos[0], isCover: true },
          { ...photos[1], isCover: false },
        ]}
      />,
    );

    expect(screen.getByText("Обкладинка")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Фото турніру" }));
    await user.click(screen.getByRole("button", { name: "Зробити обкладинкою турніру" }));

    expect(setCoverActionMock).toHaveBeenCalledWith("p2");
  });
});
