import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("home page shows the three section panels and links to them", async ({ page }) => {
    // The homepage is the TripleSplit hub (docs/HOMEPAGE.md), not the
    // "SET.club" branded hero - that content moved to /tennis. Panel
    // titles are plain divs, not headings (see triple-split.test.tsx).
    await page.goto("/");
    await expect(page.getByText("КАВА", { exact: true })).toBeVisible();
    await expect(page.getByText("ТЕНІС", { exact: true })).toBeVisible();
    await expect(page.getByText("ПАДЕЛ", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Теніс — перейти на сторінку клубу" }),
    ).toHaveAttribute("href", "/tennis");
    await expect(
      page.getByRole("link", { name: "Кава — перейти на сторінку кав'ярні" }),
    ).toHaveAttribute("href", "/coffee");
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
    await expect(page.getByRole("heading", { name: "Загальна статистика" })).toBeVisible();
  });

  test("rating page loads without authentication", async ({ page }) => {
    const response = await page.goto("/rating");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Рейтинг" })).toBeVisible();
    // Defaults to singles/Glicko-2 - the format/model pill filters should be there too.
    await expect(page.getByRole("link", { name: "Одиночні" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Glicko-2" })).toBeVisible();
  });

  test("news list loads without authentication", async ({ page }) => {
    const response = await page.goto("/news");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Новини клубу" })).toBeVisible();
  });

  test("login page offers Google sign-in", async ({ page }) => {
    await page.goto("/login");
    // The nav also renders a sign-in button, so scope to the page's main content.
    await expect(
      page.getByRole("main").getByRole("button", { name: "Увійти через Google" }),
    ).toBeVisible();
  });

  // Both pages call notFound() from inside the awaited data fetch, past
  // where Cache Components has already streamed the static shell as a 200
  // (node_modules/next/dist/docs/.../functions/not-found.md, "Calling
  // notFound() after streaming has started") - the response status can't
  // change after that point, so this is a soft 404 (real not-found UI,
  // `noindex` meta tag, but HTTP 200) rather than a true 404 status. A real
  // 404 status would need the existence check moved into `proxy` instead.
  test("unknown tournament id renders not-found UI (soft 404)", async ({ page }) => {
    const response = await page.goto("/tournaments/does-not-exist");
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/не знайдено/i)).toBeVisible();
  });

  test("unknown player id renders not-found UI (soft 404)", async ({ page }) => {
    const response = await page.goto("/players/does-not-exist");
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/не знайдено/i)).toBeVisible();
  });
});

test.describe("admin route protection", () => {
  for (const path of [
    "/admin",
    "/admin/players",
    "/admin/tournaments",
    "/admin/tournaments/new",
    "/admin/tournaments/does-not-exist",
    "/admin/tournaments/export",
    "/admin/tournaments/export/participants",
    "/admin/tournaments/export/matches",
    "/admin/news",
    "/admin/users",
  ]) {
    test(`${path} redirects unauthenticated visitors to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
