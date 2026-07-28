import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("home page shows the club name and links to key sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Set Club" })).toBeVisible();
    // Rendered as <a> styled like a button (Base UI Button exposes role="button" even for link targets).
    await expect(page.getByRole("button", { name: "Дивитись турніри" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Загальний рейтинг" })).toBeVisible();
  });

  test("tournaments list loads without authentication", async ({ page }) => {
    const response = await page.goto("/tournaments");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Турніри" })).toBeVisible();
  });

  test("players list loads without authentication", async ({ page }) => {
    const response = await page.goto("/players");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Гравці" })).toBeVisible();
  });

  test("leaderboard loads without authentication", async ({ page }) => {
    const response = await page.goto("/leaderboard");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Загальний рейтинг" })).toBeVisible();
  });

  test("login page offers Google sign-in", async ({ page }) => {
    await page.goto("/login");
    // The nav also renders a sign-in button, so scope to the page's main content.
    await expect(
      page.getByRole("main").getByRole("button", { name: "Увійти через Google" }),
    ).toBeVisible();
  });

  test("unknown tournament id renders a 404", async ({ page }) => {
    const response = await page.goto("/tournaments/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("unknown player id renders a 404", async ({ page }) => {
    const response = await page.goto("/players/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

test.describe("admin route protection", () => {
  for (const path of [
    "/admin",
    "/admin/players",
    "/admin/tournaments",
    "/admin/tournaments/new",
    "/admin/tournaments/does-not-exist",
    "/admin/news",
    "/admin/users",
  ]) {
    test(`${path} redirects unauthenticated visitors to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
