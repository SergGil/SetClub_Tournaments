import { toCsv } from "@/lib/csv";
import {
  COURT_SURFACE_LABEL,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
} from "@/lib/validation/tournament";
import type { CourtSurface, TournamentFormat, TournamentStatus } from "@/lib/validation/tournament";

export type TournamentExportRow = {
  name: string;
  format: TournamentFormat;
  surface: CourtSurface;
  status: TournamentStatus;
  startDate: Date | string;
  endDate: Date | string;
  participantsCount: number;
  matchesCount: number;
};

const HEADERS = [
  "Назва",
  "Формат",
  "Покриття",
  "Статус",
  "Дата початку",
  "Дата завершення",
  "Учасників",
  "Матчів",
];

function toIsoDate(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function buildTournamentsCsv(tournaments: TournamentExportRow[]): string {
  const rows = tournaments.map((t) => [
    t.name,
    TOURNAMENT_FORMAT_LABEL[t.format],
    COURT_SURFACE_LABEL[t.surface],
    TOURNAMENT_STATUS_LABEL[t.status],
    toIsoDate(t.startDate),
    toIsoDate(t.endDate),
    String(t.participantsCount),
    String(t.matchesCount),
  ]);
  return toCsv(HEADERS, rows);
}
