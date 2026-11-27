// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeNews } from "@/components/home-news";
import type { HomeNewsPost } from "@/components/home-news";

function post(id: string, overrides: Partial<HomeNewsPost> = {}): HomeNewsPost {
  return {
    id,
    title: `Новина ${id}`,
    body: `Текст новини ${id}.`,
    createdAt: new Date("2026-11-20T10:00:00.000Z"),
    photoUrl: null,
    ...overrides,
  };
}

describe("HomeNews", () => {
  it("renders nothing while there are no posts", () => {
    const { container } = render(<HomeNews posts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each post as a card linking to the full post, with its Kyiv date", () => {
    render(<HomeNews posts={[post("n1"), post("n2"), post("n3")]} />);

    expect(screen.getByRole("heading", { level: 2, name: "Новини клубу" })).toBeInTheDocument();
    const card = screen.getByRole("link", { name: /Новина n2/ });
    expect(card).toHaveAttribute("href", "/news/n2");
    expect(within(card).getByText("Текст новини n2.")).toBeInTheDocument();
    expect(within(card).getByText("20.11.2026")).toHaveAttribute("datetime", "2026-11-20T10:00:00.000Z");
  });

  it("links to the full news list with a button", () => {
    render(<HomeNews posts={[post("n1")]} />);
    expect(screen.getByRole("link", { name: "Усі новини" })).toHaveAttribute("href", "/news");
  });

  it("shortens a long body to a one-line-flattened excerpt", () => {
    const body = `Перший абзац.\n\n${"довгий текст ".repeat(40)}`;
    render(<HomeNews posts={[post("n1", { body })]} />);
    const text = screen.getByText(/^Перший абзац\. довгий текст/);
    expect(text.textContent!.endsWith("…")).toBe(true);
    expect(text.textContent!.length).toBeLessThanOrEqual(200);
  });

  it("shows the cover photo only for a post that has one", () => {
    const { container } = render(
      <HomeNews posts={[post("n1", { photoUrl: "https://pub.example.r2.dev/news/a.jpg" }), post("n2")]} />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});
