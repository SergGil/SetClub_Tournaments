import { describe, expect, it } from "vitest";

import { buildTournamentsCsv } from "@/lib/export/tournaments-csv";

describe("buildTournamentsCsv", () => {
  it("renders a Ukrainian header row and no data rows when empty", () => {
    const csv = buildTournamentsCsv([]);
    expect(csv).toBe(
      "Назва,Формат,Покриття,Статус,Дата початку,Дата завершення,Учасників,Матчів",
    );
  });

  it("maps enum values to their Ukrainian labels and formats dates as ISO", () => {
    const csv = buildTournamentsCsv([
      {
        name: "Весняний кубок",
        format: "DOUBLES",
        surface: "CLAY",
        status: "ONGOING",
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-04-10T00:00:00.000Z",
        participantsCount: 8,
        matchesCount: 12,
      },
    ]);
    const [, dataLine] = csv.split("\r\n");
    expect(dataLine).toBe("Весняний кубок,Парний (2×2),Ґрунт,Триває,2026-04-01,2026-04-10,8,12");
  });

  it("quotes a tournament name containing a comma", () => {
    const csv = buildTournamentsCsv([
      {
        name: "Кубок, весняний",
        format: "SINGLES",
        surface: "HARD",
        status: "UPCOMING",
        startDate: "2026-04-01",
        endDate: "2026-04-01",
        participantsCount: 0,
        matchesCount: 0,
      },
    ]);
    expect(csv).toContain('"Кубок, весняний"');
  });
});
