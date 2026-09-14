import { prisma } from "@/lib/db";
import type { AdminDomain } from "@/generated/prisma/enums";

export type HomePanelText = { eyebrow: string; title: string; description: string };

const DEFAULTS: Record<AdminDomain, HomePanelText> = {
  COFFEE: {
    eyebrow: "Спешелті",
    title: "КАВА",
    description: "Спешелті кава та корисні сніданки в затишному просторі клубу.",
  },
  TENNIS: {
    eyebrow: "Клуб",
    title: "ТЕНІС",
    description: "Ґрунтові корти та досвідчені тренери — турніри, рейтинг, тренування.",
  },
  PADEL: {
    eyebrow: "У будівництві",
    title: "ПАДЕЛ",
    description: "Скоро відкриття. Будівництво сучасних кортів у розпалі.",
  },
};

/** Homepage TripleSplit's per-domain eyebrow/title/description - falls back to the original hardcoded copy until an admin saves a given panel once (actions/home-panels.ts). */
export async function getHomePanelSettings(): Promise<Record<AdminDomain, HomePanelText>> {
  const rows = await prisma.homePanelSettings.findMany();
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const domains = Object.keys(DEFAULTS) as AdminDomain[];

  return Object.fromEntries(
    domains.map((key) => {
      const row = byKey.get(key);
      return [
        key,
        {
          eyebrow: row?.eyebrow ?? DEFAULTS[key].eyebrow,
          title: row?.title ?? DEFAULTS[key].title,
          description: row?.description ?? DEFAULTS[key].description,
        },
      ];
    }),
  ) as Record<AdminDomain, HomePanelText>;
}
