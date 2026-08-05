// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlayersTable } from "@/components/admin/players-table";
import type { PlayerWithUser } from "@/lib/queries/players";

vi.mock("@/components/admin/delete-player-button", () => ({
  DeletePlayerButton: () => <button>stub-delete</button>,
}));
vi.mock("@/components/admin/link-player-control", () => ({
  LinkPlayerControl: () => <div>stub-link-control</div>,
}));
vi.mock("@/components/admin/player-dialog", () => ({
  PlayerDialog: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>,
}));
vi.mock("@/components/admin/unlink-player-button", () => ({
  UnlinkPlayerButton: () => <button>stub-unlink</button>,
}));

function buildPlayer(overrides: Partial<PlayerWithUser> & { id: string; name: string }): PlayerWithUser {
  return {
    email: null,
    userId: null,
    user: null,
    _count: { matchAppearances: 0, tournamentEntries: 0 },
    ...overrides,
  } as PlayerWithUser;
}

describe("PlayersTable", () => {
  it("shows the linked badge and unlink control for a player with an account", () => {
    render(
      <PlayersTable
        players={[buildPlayer({ id: "p1", name: "Іван", userId: "u1" })]}
        unlinkedUsers={[]}
        hasQuery={false}
      />,
    );
    expect(screen.getByText("Прив'язано")).toBeInTheDocument();
    expect(screen.getByText("stub-unlink")).toBeInTheDocument();
    expect(screen.queryByText("stub-link-control")).not.toBeInTheDocument();
  });

  it("shows the placeholder badge and link control for a player without an account", () => {
    render(
      <PlayersTable
        players={[buildPlayer({ id: "p1", name: "Іван" })]}
        unlinkedUsers={[]}
        hasQuery={false}
      />,
    );
    expect(screen.getByText("Заглушка")).toBeInTheDocument();
    expect(screen.getByText("stub-link-control")).toBeInTheDocument();
  });

  it("falls back to the linked account's email when the player has none of their own", () => {
    render(
      <PlayersTable
        players={[
          buildPlayer({ id: "p1", name: "Іван", userId: "u1", user: { email: "acc@test.com", image: null } }),
        ]}
        unlinkedUsers={[]}
        hasQuery={false}
      />,
    );
    expect(screen.getByText("acc@test.com")).toBeInTheDocument();
  });

  it("distinguishes an empty roster from a search with no matches", () => {
    const { rerender } = render(<PlayersTable players={[]} unlinkedUsers={[]} hasQuery={false} />);
    expect(screen.getByText("Ще немає жодного гравця.")).toBeInTheDocument();

    rerender(<PlayersTable players={[]} unlinkedUsers={[]} hasQuery={true} />);
    expect(screen.getByText("Нічого не знайдено.")).toBeInTheDocument();
  });
});
