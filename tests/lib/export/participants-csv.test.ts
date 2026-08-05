import { describe, expect, it } from "vitest";

import { buildParticipantsCsv } from "@/lib/export/participants-csv";

describe("buildParticipantsCsv", () => {
  it("renders a Ukrainian header row and no data rows when empty", () => {
    expect(buildParticipantsCsv([])).toBe("Турнір,Гравець,Сіяний,Дата приєднання");
  });

  it("renders Так/Ні for seeded and formats the join date as ISO", () => {
    const csv = buildParticipantsCsv([
      {
        tournamentName: "Весняний кубок",
        playerName: "Іван Петренко",
        seeded: true,
        joinedAt: "2026-04-01T12:00:00.000Z",
      },
      {
        tournamentName: "Весняний кубок",
        playerName: "Олег Ткач",
        seeded: false,
        joinedAt: "2026-04-02T12:00:00.000Z",
      },
    ]);
    const [, row1, row2] = csv.split("\r\n");
    expect(row1).toBe("Весняний кубок,Іван Петренко,Так,2026-04-01");
    expect(row2).toBe("Весняний кубок,Олег Ткач,Ні,2026-04-02");
  });

  it("quotes a player name containing a comma", () => {
    const csv = buildParticipantsCsv([
      {
        tournamentName: "Кубок",
        playerName: "Петренко, Іван",
        seeded: false,
        joinedAt: "2026-04-01",
      },
    ]);
    expect(csv).toContain('"Петренко, Іван"');
  });
});
