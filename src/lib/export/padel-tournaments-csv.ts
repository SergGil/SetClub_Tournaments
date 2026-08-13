import { toCsv } from "@/lib/csv";
import { TOURNAMENT_FORMAT_LABEL, TOURNAMENT_STATUS_LABEL } from "@/lib/validation/tournament";
import type { TournamentFormat, TournamentStatus } from "@/lib/validation/tournament";

/** Padel twin of tournaments-csv.ts - no "Покриття" (surface) column, Padel tournaments have no CourtSurface. */
export type PadelTournamentExportRow = {
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: Date | string;
  endDate: Date | string;
  participantsCount: number;
  matchesCount: number;
};

const HEADERS = [
  "Назва",
  "Формат",
  "Статус",
  "Дата початку",
  "Дата завершення",
  "Учасників",
  "Матчів",
];

function toIsoDate(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function buildPadelTournamentsCsv(tournaments: PadelTournamentExportRow[]): string {
  const rows = tournaments.map((t) => [
    t.name,
    TOURNAMENT_FORMAT_LABEL[t.format],
    TOURNAMENT_STATUS_LABEL[t.status],
    toIsoDate(t.startDate),
    toIsoDate(t.endDate),
    String(t.participantsCount),
    String(t.matchesCount),
  ]);
  return toCsv(HEADERS, rows);
}
