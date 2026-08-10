/** [one, few, many] forms, e.g. ["матч", "матчі", "матчів"] for 1 / 2-4 / 5+. */
export type PluralForms = [one: string, few: string, many: string];

/** Ukrainian plural rule: 1→one, 2-4→few, 0/5-20→many (with the 11-14 exception). */
export function pluralizeUk(count: number, forms: PluralForms): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** e.g. countLabel(3, MATCH_FORMS) -> "3 матчі" */
export function countLabel(count: number, forms: PluralForms): string {
  return `${count} ${pluralizeUk(count, forms)}`;
}

export const MATCH_FORMS: PluralForms = ["матч", "матчі", "матчів"];
export const PLAYER_FORMS: PluralForms = ["гравець", "гравці", "гравців"];
export const TOURNAMENT_FORMS: PluralForms = ["турнір", "турніри", "турнірів"];
export const PARTICIPANT_FORMS: PluralForms = ["учасник", "учасники", "учасників"];
export const WIN_FORMS: PluralForms = ["перемога", "перемоги", "перемог"];
export const LOSS_FORMS: PluralForms = ["поразка", "поразки", "поразок"];
export const NEWS_FORMS: PluralForms = ["новина", "новини", "новин"];
export const PHOTO_FORMS: PluralForms = ["фото", "фото", "фото"];
export const POINT_FORMS: PluralForms = ["бал", "бали", "балів"];
