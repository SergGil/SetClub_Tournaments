import { z } from "zod";

export const homePanelDomainValues = ["TENNIS", "COFFEE", "PADEL"] as const;

export const HOME_PANEL_DOMAIN_LABEL: Record<(typeof homePanelDomainValues)[number], string> = {
  TENNIS: "Теніс",
  COFFEE: "Кава",
  PADEL: "Падел",
};

export const homePanelSettingsFormSchema = z.object({
  key: z.enum(homePanelDomainValues, { error: "Невідома секція" }),
  eyebrow: z.string().trim().min(1, "Вкажіть підпис").max(30),
  title: z.string().trim().min(1, "Вкажіть назву").max(20),
  description: z.string().trim().min(1, "Вкажіть опис").max(160),
});

export type HomePanelSettingsFormInput = z.infer<typeof homePanelSettingsFormSchema>;
