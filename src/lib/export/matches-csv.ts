import { toCsv } from "@/lib/csv";

export type MatchExportRow = {
  tournamentName: string;
  matchType: "SINGLES" | "DOUBLES";
  round: string | null;
  scheduledDate: Date | string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  winnerSide: "A" | "B" | null;
  players: { side: "A" | "B"; name: string }[];
  sets: { sideAGames: number; sideBGames: number }[];
};

const MATCH_TYPE_LABEL = { SINGLES: "1×1", DOUBLES: "2×2" } as const;
const MATCH_STATUS_LABEL = {
  SCHEDULED: "Заплановано",
  COMPLETED: "Завершено",
  CANCELLED: "Скасовано",
} as const;

const HEADERS = [
  "Турнір",
  "Тип",
  "Раунд",
  "Дата",
  "Статус",
  "Сторона A",
  "Сторона B",
  "Рахунок",
  "Переможець",
];

function sideNames(players: MatchExportRow["players"], side: "A" | "B"): string {
  return players
    .filter((p) => p.side === side)
    .map((p) => p.name)
    .join(" / ");
}

function formatScore(sets: MatchExportRow["sets"]): string {
  return sets.map((s) => `${s.sideAGames}-${s.sideBGames}`).join(", ");
}

function toIsoDate(date: Date | string | null): string {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

export function buildMatchesCsv(matches: MatchExportRow[]): string {
  const rows = matches.map((m) => {
    const sideA = sideNames(m.players, "A");
    const sideB = sideNames(m.players, "B");
    const winner = m.winnerSide === "A" ? sideA : m.winnerSide === "B" ? sideB : "";
    return [
      m.tournamentName,
      MATCH_TYPE_LABEL[m.matchType],
      m.round ?? "",
      toIsoDate(m.scheduledDate),
      MATCH_STATUS_LABEL[m.status],
      sideA,
      sideB,
      formatScore(m.sets),
      winner,
    ];
  });
  return toCsv(HEADERS, rows);
}
