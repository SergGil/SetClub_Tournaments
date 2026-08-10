import { describe, expect, it } from "vitest";

import { buildTournamentShareData } from "@/lib/share/tournament-card-data";
import type { PlacedStandingsRow, TournamentStandingsResult } from "@/lib/tournament-standings";

function placedRow(
  place: number | null,
  label: string,
  wins: number,
  losses: number,
): PlacedStandingsRow {
  return {
    key: label,
    label,
    matchesPlayed: wins + losses,
    wins,
    losses,
    winPct: 0,
    gamesWon: 0,
    gamesLost: 0,
    points: 0,
    place,
  };
}

function standingsWithPlacedTable(
  rows: PlacedStandingsRow[],
  complete: boolean,
): TournamentStandingsResult {
  return { mode: "individual", rows: [], roundRobinDone: true, placedTable: { rows, complete } };
}

describe("buildTournamentShareData", () => {
  it("returns null when the tournament has no placed table at all", () => {
    const standings: TournamentStandingsResult = { mode: "individual", rows: [], roundRobinDone: false };
    expect(buildTournamentShareData("Кубок", 8, standings)).toBeNull();
  });

  it("returns null while the placed table isn't complete yet", () => {
    const standings = standingsWithPlacedTable([placedRow(1, "Іван", 5, 0)], false);
    expect(buildTournamentShareData("Кубок", 8, standings)).toBeNull();
  });

  it("returns null if, somehow, a complete table has no row in the top 3", () => {
    const standings = standingsWithPlacedTable([placedRow(null, "Іван", 5, 0)], true);
    expect(buildTournamentShareData("Кубок", 8, standings)).toBeNull();
  });

  it("returns the top 3 sorted by place, with the tournament's own W-L record (not SET.club rating points)", () => {
    const standings = standingsWithPlacedTable(
      [
        placedRow(3, "Третій", 4, 2),
        placedRow(1, "Перший", 6, 0),
        placedRow(2, "Другий", 5, 1),
        placedRow(4, "Четвертий", 2, 4),
      ],
      true,
    );

    expect(buildTournamentShareData("Осінній кубок", 12, standings)).toEqual({
      tournamentName: "Осінній кубок",
      participantCount: 12,
      podium: [
        { place: 1, label: "Перший", wins: 6, losses: 0 },
        { place: 2, label: "Другий", wins: 5, losses: 1 },
        { place: 3, label: "Третій", wins: 4, losses: 2 },
      ],
    });
  });

  it("still works for a partial podium (e.g. a 2-player final)", () => {
    const standings = standingsWithPlacedTable([placedRow(1, "Переможець", 3, 0), placedRow(2, "Другий", 0, 3)], true);

    expect(buildTournamentShareData("Фінал", 2, standings)?.podium).toEqual([
      { place: 1, label: "Переможець", wins: 3, losses: 0 },
      { place: 2, label: "Другий", wins: 0, losses: 3 },
    ]);
  });
});
