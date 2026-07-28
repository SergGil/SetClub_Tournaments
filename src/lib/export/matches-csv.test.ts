import { describe, expect, it } from "vitest";

import { buildMatchesCsv } from "@/lib/export/matches-csv";

describe("buildMatchesCsv", () => {
  it("renders a Ukrainian header row and no data rows when empty", () => {
    expect(buildMatchesCsv([])).toBe(
      "Турнір,Тип,Раунд,Дата,Статус,Сторона A,Сторона B,Рахунок,Переможець",
    );
  });

  it("joins side player names and formats the set score", () => {
    const csv = buildMatchesCsv([
      {
        tournamentName: "Весняний кубок",
        matchType: "DOUBLES",
        round: "Фінал",
        scheduledDate: "2026-04-10T00:00:00.000Z",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", name: "Іван" },
          { side: "A", name: "Олег" },
          { side: "B", name: "Петро" },
          { side: "B", name: "Тарас" },
        ],
        sets: [
          { sideAGames: 6, sideBGames: 4 },
          { sideAGames: 6, sideBGames: 3 },
        ],
      },
    ]);
    const [, dataLine] = csv.split("\r\n");
    expect(dataLine).toBe(
      'Весняний кубок,2×2,Фінал,2026-04-10,Завершено,Іван / Олег,Петро / Тарас,"6-4, 6-3",Іван / Олег',
    );
  });

  it("leaves the winner column blank when there is no winner yet", () => {
    const csv = buildMatchesCsv([
      {
        tournamentName: "Кубок",
        matchType: "SINGLES",
        round: null,
        scheduledDate: null,
        status: "SCHEDULED",
        winnerSide: null,
        players: [
          { side: "A", name: "Іван" },
          { side: "B", name: "Петро" },
        ],
        sets: [],
      },
    ]);
    const [, dataLine] = csv.split("\r\n");
    expect(dataLine).toBe("Кубок,1×1,,,Заплановано,Іван,Петро,,");
  });
});
