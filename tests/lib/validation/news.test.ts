import { describe, expect, it } from "vitest";

import { newsPostFormSchema } from "@/lib/validation/news";

describe("newsPostFormSchema", () => {
  it("accepts a valid post", () => {
    const result = newsPostFormSchema.safeParse({
      title: "Відкриття сезону",
      body: "Запрошуємо всіх на відкриття літнього сезону.",
    });
    expect(result.success).toBe(true);
  });

  it("trims title and body", () => {
    const result = newsPostFormSchema.safeParse({ title: "  Новина  ", body: "  Текст  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Новина");
      expect(result.data.body).toBe("Текст");
    }
  });

  it("rejects a blank title", () => {
    expect(newsPostFormSchema.safeParse({ title: "   ", body: "Текст" }).success).toBe(false);
  });

  it("rejects a blank body", () => {
    expect(newsPostFormSchema.safeParse({ title: "Заголовок", body: "   " }).success).toBe(false);
  });

  it("rejects a title over 150 characters", () => {
    const result = newsPostFormSchema.safeParse({ title: "a".repeat(151), body: "Текст" });
    expect(result.success).toBe(false);
  });

  it("rejects a body over 5000 characters", () => {
    const result = newsPostFormSchema.safeParse({ title: "Заголовок", body: "a".repeat(5001) });
    expect(result.success).toBe(false);
  });
});
