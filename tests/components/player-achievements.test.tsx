// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PlayerAchievements } from "@/components/player-achievements";
import type { Achievement } from "@/lib/achievements";

const achievements: Achievement[] = [
  { id: "debut", label: "Дебют", description: "Зіграв перший матч у клубі", earned: true, earnedAt: "2026-01-05T00:00:00.000Z" },
  { id: "champion-tennis-singles", label: "Чемпіон: теніс, одиночний", description: "Виграв фінал", earned: false },
];

describe("PlayerAchievements", () => {
  it("shows the earned/total counter and every chip, locked ones included", () => {
    render(<PlayerAchievements achievements={achievements} />);
    expect(screen.getByText("(1 з 2)")).toBeInTheDocument();
    expect(screen.getByText("Дебют")).toBeInTheDocument();
    expect(screen.getByText("Чемпіон: теніс, одиночний")).toBeInTheDocument();
  });

  it("hides and re-shows the chips via the toggle, remembering the choice in localStorage", async () => {
    const user = userEvent.setup();
    render(<PlayerAchievements achievements={achievements} />);

    await user.click(screen.getByRole("button", { name: "Сховати" }));
    expect(screen.queryByText("Дебют")).not.toBeInTheDocument();
    expect(localStorage.getItem("setclub:achievements-hidden")).toBe("1");

    await user.click(screen.getByRole("button", { name: "Показати" }));
    expect(screen.getByText("Дебют")).toBeInTheDocument();
    expect(localStorage.getItem("setclub:achievements-hidden")).toBe("0");
  });
});
