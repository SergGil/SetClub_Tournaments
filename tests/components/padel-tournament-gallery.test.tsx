// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PadelTournamentGallery } from "@/components/padel-tournament-gallery";

const { getPhotosByPadelTournamentMock } = vi.hoisted(() => ({ getPhotosByPadelTournamentMock: vi.fn() }));
vi.mock("@/lib/queries/padel-photos", () => ({ getPhotosByPadelTournament: getPhotosByPadelTournamentMock }));

vi.mock("@/lib/actions/padel-photos", () => ({ deletePadelPhotoAction: vi.fn() }));

vi.mock("@/components/photo-lightbox", () => ({
  PhotoLightbox: ({ photos, canManage }: { photos: { id: string }[]; canManage: boolean }) => (
    <div data-testid="lightbox-stub">
      {photos.length} фото, canManage={String(canManage)}
    </div>
  ),
}));

describe("PadelTournamentGallery", () => {
  it("renders nothing when the tournament has no photos", async () => {
    getPhotosByPadelTournamentMock.mockResolvedValueOnce([]);
    const element = await PadelTournamentGallery({ tournamentId: "t1", canManage: false });
    expect(element).toBeNull();
  });

  it("renders the section heading and passes photos + canManage through to the lightbox", async () => {
    getPhotosByPadelTournamentMock.mockResolvedValueOnce([
      { id: "p1", url: "https://pub-test.r2.dev/p1.jpg", caption: "Фінал" },
    ]);
    render(await PadelTournamentGallery({ tournamentId: "t1", canManage: true }));

    expect(getPhotosByPadelTournamentMock).toHaveBeenCalledWith("t1");
    expect(screen.getByRole("heading", { name: "Фото" })).toBeInTheDocument();
    expect(screen.getByTestId("lightbox-stub")).toHaveTextContent("1 фото, canManage=true");
  });
});
