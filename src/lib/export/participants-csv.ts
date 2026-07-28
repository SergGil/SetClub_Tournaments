import { toCsv } from "@/lib/csv";

export type ParticipantExportRow = {
  tournamentName: string;
  playerName: string;
  seeded: boolean;
  joinedAt: Date | string;
};

const HEADERS = ["Турнір", "Гравець", "Сіяний", "Дата приєднання"];

function toIsoDate(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function buildParticipantsCsv(rows: ParticipantExportRow[]): string {
  const csvRows = rows.map((r) => [
    r.tournamentName,
    r.playerName,
    r.seeded ? "Так" : "Ні",
    toIsoDate(r.joinedAt),
  ]);
  return toCsv(HEADERS, csvRows);
}
