// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { NewsCard } from "@/components/news-card";

const post = {
  id: "n1",
  title: "Тенісний вікенд у нашому клубі",
  body: "Перший рядок.\nДругий рядок.\nТретій рядок.",
  createdAt: new Date("2026-08-04T00:00:00.000Z"),
};

describe("NewsCard", () => {
  it("links the title to the full post", () => {
    render(<NewsCard post={post} />);
    expect(screen.getByRole("link", { name: post.title })).toHaveAttribute("href", "/news/n1");
  });

  it("shows the author label when given, and omits it otherwise", () => {
    const { rerender } = render(<NewsCard post={post} authorLabel="Оля" />);
    expect(screen.getByText(/Оля/)).toBeInTheDocument();

    rerender(<NewsCard post={post} />);
    expect(screen.queryByText(/Оля/)).not.toBeInTheDocument();
  });

  it("shows the cover photo when the post has one, and omits it otherwise", () => {
    const { container, rerender } = render(
      <NewsCard post={{ ...post, photoUrl: "https://r2.example.com/news/photo.jpg" }} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      encodeURIComponent("https://r2.example.com/news/photo.jpg"),
    );

    rerender(<NewsCard post={post} />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  describe("when the body doesn't overflow the clamp", () => {
    beforeEach(() => {
      Object.defineProperty(HTMLParagraphElement.prototype, "scrollHeight", {
        configurable: true,
        value: 60,
      });
      Object.defineProperty(HTMLParagraphElement.prototype, "clientHeight", {
        configurable: true,
        value: 60,
      });
    });

    it("shows no expand toggle", () => {
      render(<NewsCard post={post} />);
      expect(screen.queryByRole("button", { name: "Читати повністю" })).not.toBeInTheDocument();
    });
  });

  describe("when the body overflows the clamp", () => {
    beforeEach(() => {
      Object.defineProperty(HTMLParagraphElement.prototype, "scrollHeight", {
        configurable: true,
        value: 200,
      });
      Object.defineProperty(HTMLParagraphElement.prototype, "clientHeight", {
        configurable: true,
        value: 60,
      });
    });

    it("expands and re-collapses the body inline without navigating away", async () => {
      const user = userEvent.setup();
      render(<NewsCard post={post} />);

      const body = screen.getByText(/Перший рядок/);
      expect(body.className).toContain("line-clamp-4");

      await user.click(screen.getByRole("button", { name: "Читати повністю" }));
      expect(body.className).not.toContain("line-clamp-4");
      expect(screen.getByRole("button", { name: "Згорнути" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Згорнути" }));
      expect(body.className).toContain("line-clamp-4");
      expect(screen.getByRole("button", { name: "Читати повністю" })).toBeInTheDocument();
    });
  });
});
