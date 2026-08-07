import { toIsoDateKyiv } from "@/lib/date-format";
import { toCsv } from "@/lib/csv";

export type ParticipantExportRow = {
  tournamentName: string;
  playerName: string;
  seeded: boolean;
  joinedAt: Date | string;
};

const HEADERS = ["Турнір", "Гравець", "Сіяний", "Дата приєднання"];

export function buildParticipantsCsv(rows: ParticipantExportRow[]): string {
  const csvRows = rows.map((r) => [
    r.tournamentName,
    r.playerName,
    r.seeded ? "Так" : "Ні",
    toIsoDateKyiv(r.joinedAt),
  ]);
  return toCsv(HEADERS, csvRows);
}
