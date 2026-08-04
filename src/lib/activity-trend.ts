const MONTH_LABELS = [
  "Січ",
  "Лют",
  "Бер",
  "Кві",
  "Тра",
  "Чер",
  "Лип",
  "Сер",
  "Вер",
  "Жов",
  "Лис",
  "Гру",
] as const;

export type MonthlyCount = { key: string; label: string; count: number };

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`;
}

function nextMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Every calendar month from the earliest date across `dateSets` through the current month - so a quiet month reads as a real zero bar, not a missing one. Empty if every set is empty. */
export function monthsBetween(dateSets: Date[][]): string[] {
  const allDates = dateSets.flat();
  if (allDates.length === 0) return [];

  const start = allDates.map(monthKey).sort()[0];
  const end = monthKey(new Date());

  const months: string[] = [];
  for (let key = start; key <= end; key = nextMonthKey(key)) {
    months.push(key);
  }
  return months;
}

/** Buckets `dates` into the given `months` (see monthsBetween), zero-filling months with no dates. */
export function bucketByMonth(dates: Date[], months: string[]): MonthlyCount[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = monthKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return months.map((key) => ({ key, label: monthLabel(key), count: counts.get(key) ?? 0 }));
}
