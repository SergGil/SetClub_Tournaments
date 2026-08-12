import { expect, test } from "@playwright/test";

// Requires E2E_TEST_LOGIN_SECRET (see .env.example) - signs in via the
// test-only /api/test-login route instead of real Google OAuth. That route
// always 404s when NODE_ENV=production, so these tests only ever run
// against a local/CI dev server, never against the deployed site.
const secret = process.env.E2E_TEST_LOGIN_SECRET;

test.describe("authenticated admin flows", () => {
  test.skip(!secret, "E2E_TEST_LOGIN_SECRET not set - skipping authenticated admin tests");
  // These tests share one fixed test-admin user/session, not independent
  // data, so run them one at a time rather than racing in parallel workers.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    const response = await page.request.post("/api/test-login", { data: { secret } });
    expect(response.ok()).toBe(true);
  });

  // Every test in this file names what it creates "Playwright ..." so this
  // sweeps it all up - the tests run against the same database as `npm run
  // dev` (there's no separate throwaway test DB for this project), so
  // leftover rows would otherwise accumulate for real. Plain fetch rather
  // than a fixture: `request`/`page` are test-scoped, not available here.
  test.afterAll(async () => {
    await fetch("http://localhost:3000/api/test-login/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
  });

  test("test-login rejects an incorrect secret", async ({ request }) => {
    const response = await request.post("/api/test-login", { data: { secret: "wrong" } });
    expect(response.status()).toBe(403);
  });

  test("admin can reach the admin panel", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Адмін-панель" })).toBeVisible();
  });

  test("admin can create a player and see it in the list", async ({ page }) => {
    const name = `Playwright Player ${Date.now()}`;
    await page.goto("/admin/players");
    await page.getByRole("button", { name: "Додати гравця" }).click();
    await page.getByLabel("Ім'я").fill(name);
    await page.getByRole("button", { name: "Створити" }).click();
    // The list defaults to the first page (20 of 35+ real players, sorted by
    // creation date) - a brand-new player isn't guaranteed to land on it.
    // Searching by its own (unique, timestamped) name filters it into view
    // regardless of where it'd otherwise sort/paginate to.
    await page.getByRole("searchbox", { name: "Пошук за іменем чи email" }).fill(name);
    await expect(page.getByText(name)).toBeVisible();
  });

  test("admin can create a tournament and land on its detail page", async ({ page }) => {
    const name = `Playwright Cup ${Date.now()}`;
    await page.goto("/admin/tournaments/new");
    await page.getByLabel("Назва турніру").fill(name);
    await page.getByLabel("Дата початку").fill("2026-01-01");
    await page.getByLabel("Дата завершення").fill("2026-01-02");
    await page.getByRole("button", { name: "Створити турнір" }).click();
    // Excludes "new" itself - createTournamentAction redirects to the
    // freshly created tournament's /admin/tournaments/<id> detail page.
    await expect(page).toHaveURL(/\/admin\/tournaments\/(?!new$)[\w-]+$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });

  test("superadmin can reach /admin/users and /admin/audit", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL("/admin/users");
    await page.goto("/admin/audit");
    await expect(page).toHaveURL(/\/admin\/audit/);
  });

  // Domain-scoped access (docs/ADMIN_DOMAINS.md): re-logs in as a narrower
  // role than the SUPERADMIN default beforeEach sets up - each test below
  // ends with `beforeEach` re-establishing SUPERADMIN for whatever runs
  // next, so this scoping never leaks between tests.
  test("an ADMIN scoped to TENNIS reaches tennis admin pages but is bounced from /admin/users and /admin/audit", async ({
    page,
    request,
  }) => {
    const response = await request.post("/api/test-login", {
      data: { secret, role: "ADMIN", domains: ["TENNIS"] },
    });
    expect(response.ok()).toBe(true);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Адмін-панель" })).toBeVisible();
    // href-scoped, not role name - "Турніри"/"Користувачі" also appear as
    // the public site nav link and the /admin overview's own card link.
    await expect(page.locator('nav a[href="/admin/tournaments"]')).toBeVisible();
    await expect(page.locator('nav a[href="/admin/users"]')).not.toBeVisible();

    await page.goto("/admin/tournaments");
    await expect(page).toHaveURL("/admin/tournaments");

    await page.goto("/admin/users");
    await expect(page).toHaveURL("/admin");
    await page.goto("/admin/audit");
    await expect(page).toHaveURL("/admin");
  });

  test("an ADMIN with no domains granted has no admin access at all", async ({ page, request }) => {
    const response = await request.post("/api/test-login", {
      data: { secret, role: "ADMIN", domains: [] },
    });
    expect(response.ok()).toBe(true);

    await page.goto("/admin");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: "Адмін-панель" })).not.toBeVisible();
  });
});
