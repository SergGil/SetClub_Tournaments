// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TripleSplit } from "@/components/triple-split";

const panelText = {
  COFFEE: { eyebrow: "Спешелті", title: "КАВА", description: "Опис кави" },
  TENNIS: { eyebrow: "Клуб", title: "ТЕНІС", description: "Опис тенісу" },
  PADEL: { eyebrow: "У будівництві", title: "ПАДЕЛ", description: "Опис падела" },
} as const;

describe("TripleSplit (panel words)", () => {
  it("renders all three panel words", () => {
    render(<TripleSplit padelAuthorized={false} panelText={panelText} />);
    expect(screen.getByText("КАВА")).toBeInTheDocument();
    expect(screen.getByText("ТЕНІС")).toBeInTheDocument();
    expect(screen.getByText("ПАДЕЛ")).toBeInTheDocument();
  });
});

describe("TripleSplit (Tennis panel)", () => {
  it("is always clickable, linking to /tennis", () => {
    render(<TripleSplit padelAuthorized={false} panelText={panelText} />);
    expect(screen.getByRole("link", { name: "Теніс — перейти на сторінку клубу" })).toHaveAttribute(
      "href",
      "/tennis",
    );
  });

  it("offers a booking CTA linking to /tennis/pricing", () => {
    render(<TripleSplit padelAuthorized={false} panelText={panelText} />);
    expect(screen.getByRole("link", { name: "Забронювати корт" })).toHaveAttribute("href", "/tennis/pricing");
  });
});

describe("TripleSplit (Coffee panel)", () => {
  it("offers a menu CTA linking to /coffee", () => {
    render(<TripleSplit padelAuthorized={false} panelText={panelText} />);
    expect(screen.getByRole("link", { name: "Меню кав'ярні" })).toHaveAttribute("href", "/coffee");
  });
});

describe("TripleSplit (Padel panel, unauthorized)", () => {
  it("shows the Coming Soon badge and a disabled 'Незабаром' affordance, no clickable overlay", () => {
    render(<TripleSplit padelAuthorized={false} panelText={panelText} />);
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(screen.getByText("Незабаром")).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.queryByRole("link", { name: "Падел — перейти на сторінку розділу (адмін)" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Переглянути (адмін)" })).not.toBeInTheDocument();
  });
});

describe("TripleSplit (Padel panel, authorized admin)", () => {
  it("still shows Coming Soon, but becomes clickable through to /padel with an admin CTA instead of 'Незабаром'", () => {
    render(<TripleSplit padelAuthorized panelText={panelText} />);
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(screen.queryByText("Незабаром")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Падел — перейти на сторінку розділу (адмін)" }),
    ).toHaveAttribute("href", "/padel");
    expect(screen.getByRole("link", { name: "Переглянути (адмін)" })).toHaveAttribute("href", "/padel");
  });
});
