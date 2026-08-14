// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TournamentGallery } from "@/components/tournament-gallery";

const { getPhotosByTournamentMock } = vi.hoisted(() => ({ getPhotosByTournamentMock: vi.fn() }));
vi.mock("@/lib/queries/photos", () => ({ getPhotosByTournament: getPhotosByTournamentMock }));

vi.mock("@/lib/actions/photos", () => ({ deletePhotoAction: vi.fn() }));

vi.mock("@/components/photo-lightbox", () => ({
  PhotoLightbox: ({ photos, canManage }: { photos: { id: string }[]; canManage: boolean }) => (
    <div data-testid="lightbox-stub">
      {photos.length} фото, canManage={String(canManage)}
    </div>
  ),
}));

describe("TournamentGallery", () => {
  it("renders nothing when the tournament has no photos", async () => {
    getPhotosByTournamentMock.mockResolvedValueOnce([]);
    const element = await TournamentGallery({ tournamentId: "t1", canManage: false });
    expect(element).toBeNull();
  });

  it("renders the section heading and passes photos + canManage through to the lightbox", async () => {
    getPhotosByTournamentMock.mockResolvedValueOnce([
      { id: "p1", url: "https://pub-test.r2.dev/p1.jpg", caption: "Фінал" },
    ]);
    render(await TournamentGallery({ tournamentId: "t1", canManage: true }));

    expect(getPhotosByTournamentMock).toHaveBeenCalledWith("t1");
    expect(screen.getByRole("heading", { name: "Фото" })).toBeInTheDocument();
    expect(screen.getByTestId("lightbox-stub")).toHaveTextContent("1 фото, canManage=true");
  });
});
