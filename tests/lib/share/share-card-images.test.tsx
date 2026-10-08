import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SITE_DESCRIPTION } from "@/lib/site";
import {
  InitialAvatar,
  ShareCardBackground,
  ShareCardFooter,
  ShareCardHeader,
} from "@/lib/share/card-chrome";
import { defaultShareCardElement } from "@/lib/share/default-card-image";
import type { MatchShareData } from "@/lib/share/match-card-data";
import { matchShareCardElement } from "@/lib/share/match-card-image";
import type { SeasonShareData } from "@/lib/share/season-card-data";
import { seasonShareCardElement } from "@/lib/share/season-card-image";
import type { TournamentShareData } from "@/lib/share/tournament-card-data";
import { tournamentShareCardElement } from "@/lib/share/tournament-card-image";

// The share cards are plain JSX with inline styles (Satori renders them in production), so
// rendering them to static markup is enough to check WHAT they say - the layout engine itself is
// next/og's. These are smoke + content tests: the right text in the right places, optional blocks
// really optional, and nothing throwing on sparse data.

const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("card chrome", () => {
  it("InitialAvatar falls back to the uppercased first letter", () => {
    expect(html(<InitialAvatar label="іван" tone="muted" />)).toContain(">І<");
  });

  it("InitialAvatar shows the real photo (with the label as alt) instead of the initial when there is one", () => {
    const markup = html(<InitialAvatar label="Іван" image="https://img.example/i.jpg" tone="accent" size={60} />);
    expect(markup).toContain('src="https://img.example/i.jpg"');
    expect(markup).toContain('alt="Іван"');
    expect(markup).not.toContain(">І<");
  });

  it("InitialAvatar rings a winner's photo in gold and a loser's in the faint border colour", () => {
    const winner = html(<InitialAvatar label="A" image="x" tone="accent" />);
    const loser = html(<InitialAvatar label="A" image="x" tone="muted" />);
    expect(winner).toContain("3px solid #f5b942");
    expect(loser).toContain("2px solid rgba(255,255,255,0.14)");
  });

  it("InitialAvatar sizes the photo inside its ring", () => {
    expect(html(<InitialAvatar label="A" image="x" tone="accent" size={64} />)).toContain('width="58"');
    expect(html(<InitialAvatar label="A" image="x" tone="muted" size={64} />)).toContain('width="60"');
  });

  it("ShareCardHeader shows the brand, the eyebrow and - only when given - the context pill", () => {
    const bare = html(<ShareCardHeader eyebrow="Результат матчу" />);
    expect(bare).toContain("SET.club");
    expect(bare).toContain("Результат матчу");

    const withPill = html(<ShareCardHeader eyebrow="x" pill={{ title: "Літній кубок", subtitle: "1×1 · Фінал" }} />);
    expect(withPill).toContain("Літній кубок");
    expect(withPill).toContain("1×1 · Фінал");

    const titleOnly = html(<ShareCardHeader eyebrow="x" pill={{ title: "Кубок" }} />);
    expect(titleOnly).toContain("Кубок");
    expect(count(titleOnly, "font-size:15px")).toBe(0); // no subtitle line
  });

  it("ShareCardFooter always carries the site URL, and the left label when given", () => {
    expect(html(<ShareCardFooter />)).toContain("set-club.vercel.app");
    expect(html(<ShareCardFooter left="12 учасників" />)).toContain("12 учасників");
  });

  it("ShareCardBackground renders without props", () => {
    expect(html(<ShareCardBackground />)).toContain("radial-gradient");
  });
});

function side(overrides: Partial<MatchShareData["sideA"]> = {}): MatchShareData["sideA"] {
  return { players: [{ name: "Іван", image: null }], isWinner: false, sets: [], ...overrides };
}

function matchData(overrides: Partial<MatchShareData> = {}): MatchShareData {
  return {
    tournamentName: "Літній кубок",
    round: "Фінал",
    matchTypeLabel: "1×1",
    badge: null,
    sideA: side({
      players: [{ name: "Іван", image: null }],
      isWinner: true,
      sets: [
        { value: 7, tiebreak: 5 },
        { value: 6, tiebreak: null },
      ],
    }),
    sideB: side({
      players: [{ name: "Петро", image: null }],
      sets: [
        { value: 6, tiebreak: null },
        { value: 4, tiebreak: null },
      ],
    }),
    ...overrides,
  };
}

describe("matchShareCardElement", () => {
  it("shows the tournament, 'type · round' subtitle, both players and the VS marker", () => {
    const markup = html(matchShareCardElement(matchData()));
    expect(markup).toContain("Результат матчу");
    expect(markup).toContain("Літній кубок");
    expect(markup).toContain("1×1 · Фінал");
    expect(markup).toContain("Іван");
    expect(markup).toContain("Петро");
    expect(markup).toContain("VS");
  });

  it("drops the round from the subtitle when the match has none", () => {
    const markup = html(matchShareCardElement(matchData({ round: null })));
    expect(markup).toContain(">1×1<");
    expect(markup).not.toContain("·");
  });

  it("marks only the winning side with a 'Перемога' badge", () => {
    expect(count(html(matchShareCardElement(matchData())), "Перемога")).toBe(1);
  });

  it("lists every set for both sides, with a tiebreak score in brackets only where there is one", () => {
    const markup = html(matchShareCardElement(matchData()));
    for (const value of ["7", "6", "4"]) expect(markup).toContain(`>${value}<`);
    expect(markup).toContain("(5)");
    expect(markup.match(/>\(\d+\)</g)).toHaveLength(1);
  });

  it("shows no score row when no sets were recorded (e.g. a walkover)", () => {
    const markup = html(
      matchShareCardElement(matchData({ sideA: side({ isWinner: true }), sideB: side({ players: [{ name: "Петро", image: null }] }) })),
    );
    expect(markup).not.toContain("font-size:46px");
  });

  it("puts the retired/walkover badge in the footer", () => {
    expect(html(matchShareCardElement(matchData({ badge: "Технічна поразка" })))).toContain("Технічна поразка");
  });

  it("renders a doubles side with both partners' names and smaller avatars", () => {
    const markup = html(
      matchShareCardElement(
        matchData({
          sideA: side({
            players: [
              { name: "Іван", image: null },
              { name: "Олег", image: "https://img.example/o.jpg" },
            ],
            isWinner: true,
          }),
        }),
      ),
    );
    expect(markup).toContain("Іван");
    expect(markup).toContain("Олег");
    expect(markup).toContain('src="https://img.example/o.jpg"');
    expect(markup).toContain("width:52px"); // doubles avatar size
  });

  it("caps a side at two avatars even if more players are listed", () => {
    const markup = html(
      matchShareCardElement(
        matchData({
          sideA: side({
            players: ["Аа", "Бб", "Вв"].map((name) => ({ name, image: "https://img.example/x.jpg" })),
            isWinner: true,
          }),
        }),
      ),
    );
    expect(count(markup, "<img")).toBe(2);
  });
});

describe("tournamentShareCardElement", () => {
  const podium: TournamentShareData["podium"] = [
    { place: 1, label: "Іван", wins: 3, losses: 0 },
    { place: 2, label: "Петро", wins: 2, losses: 1 },
    { place: 3, label: "Олег", wins: 1, losses: 2 },
  ];
  const data: TournamentShareData = { tournamentName: "Літній кубок", participantCount: 8, podium };

  it("shows the tournament, each finisher with their record, and the participant count", () => {
    const markup = html(tournamentShareCardElement(data));
    expect(markup).toContain("Підсумки турніру");
    expect(markup).toContain("Літній кубок");
    expect(markup).toContain("3-0");
    expect(markup).toContain("2-1");
    expect(markup).toContain("1-2");
    expect(markup).toContain("8 учасників");
  });

  it("draws the podium 2nd - 1st - 3rd regardless of the data order", () => {
    const markup = html(tournamentShareCardElement({ ...data, podium: [...podium].reverse() }));
    const order = ["Петро", "Іван", "Олег"].map((name) => markup.indexOf(name));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("crowns only the winner with a trophy", () => {
    expect(count(html(tournamentShareCardElement(data)), "🏆")).toBe(1);
  });

  it("copes with a podium that has fewer than three places", () => {
    const markup = html(tournamentShareCardElement({ ...data, participantCount: 1, podium: [podium[0]] }));
    expect(markup).toContain("Іван");
    expect(markup).not.toContain("Петро");
    expect(markup).toContain("1 учасник");
  });
});

describe("seasonShareCardElement", () => {
  const data: SeasonShareData = {
    year: 2026,
    matchesPlayed: 42,
    tournamentsCompleted: 5,
    topSingles: { name: "Іван", points: 120 },
    topDoubles: { name: "Петро / Олег", points: 95 },
  };

  it("shows the year, the pluralised totals and both leaders with their SET.club points", () => {
    const markup = html(seasonShareCardElement(data));
    expect(markup).toContain("Підсумки сезону");
    expect(markup).toContain("2026 рік у SET.club");
    expect(markup).toContain("42 матчі<"); // 42 -> "матчі" (2-4 ending), not "матчів"
    expect(markup).toContain("5 турнірів");
    expect(markup).toContain("Топ одиночний");
    expect(markup).toContain("Іван");
    expect(markup).toContain("120 балів SET.club");
    expect(markup).toContain("Топ парний");
    expect(markup).toContain("Петро / Олег");
    expect(markup).toContain("95 балів SET.club");
  });

  it("uses the singular form for one match and one tournament", () => {
    const markup = html(seasonShareCardElement({ ...data, matchesPlayed: 1, tournamentsCompleted: 1 }));
    expect(markup).toContain("1 матч<");
    expect(markup).toContain("1 турнір<");
  });

  it("leaves out a leader block that has no entry", () => {
    const markup = html(seasonShareCardElement({ ...data, topDoubles: null }));
    expect(markup).toContain("Топ одиночний");
    expect(markup).not.toContain("Топ парний");
    const none = html(seasonShareCardElement({ ...data, topSingles: null, topDoubles: null }));
    expect(none).not.toContain("Топ");
  });
});

describe("defaultShareCardElement", () => {
  it("is the brand card: club-site eyebrow, the site description and the URL", () => {
    const markup = html(defaultShareCardElement());
    expect(markup).toContain("Клубний сайт");
    expect(markup).toContain(SITE_DESCRIPTION.replace(/&/g, "&amp;"));
    expect(markup).toContain("set-club.vercel.app");
  });
});
