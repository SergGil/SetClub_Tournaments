import { z } from "zod";

export const newsPostFormSchema = z.object({
  title: z.string().trim().min(1, "Вкажіть заголовок").max(150),
  body: z.string().trim().min(1, "Вкажіть текст новини").max(5000),
});

export type NewsPostFormInput = z.infer<typeof newsPostFormSchema>;
