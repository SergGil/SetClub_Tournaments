import { expect, test } from "@playwright/test";

// See admin-flows.spec.ts for the test-login/cleanup setup this shares.
const secret = process.env.E2E_TEST_LOGIN_SECRET;

test.describe("match management flow", () => {
  test.skip(!secret, "E2E_TEST_LOGIN_SECRET not set - skipping authenticated admin tests");
  // Each test builds on the tournament/participants the previous one set up.
  test.describe.configure({ mode: "serial" });

  const stamp = Date.now();
  const playerAName = `Playwright Match Flow A ${stamp}`;
  const playerBName = `Playwright Match Flow B ${stamp}`;
  const tournamentName = `Playwright Match Flow Cup ${stamp}`;
  let tournamentUrl = "";

  test.beforeEach(async ({ page }) => {
    const response = await page.request.post("/api/test-login", { data: { secret } });
    expect(response.ok()).toBe(true);
  });

  test.afterAll(async () => {
    await fetch("http://localhost:3000/api/test-login/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
  });

  test("admin sets up a singles tournament with two participants", async ({ page }) => {
    await page.goto("/admin/players");
    for (const name of [playerAName, playerBName]) {
      await page.getByRole("button", { name: "Додати гравця" }).click();
      await page.getByLabel("Ім'я").fill(name);
      await page.getByRole("button", { name: "Створити" }).click();
      // Revalidating after the mutation takes a few seconds against the remote DB.
      await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
    }

    // Format defaults to SINGLES, which is what the rest of this flow needs.
    await page.goto("/admin/tournaments/new");
    await page.getByLabel("Назва турніру").fill(tournamentName);
    await page.getByLabel("Дата початку").fill("2026-01-01");
    await page.getByLabel("Дата завершення").fill("2026-01-02");
    await page.getByRole("button", { name: "Створити турнір" }).click();
    await expect(page).toHaveURL(/\/admin\/tournaments\/(?!new$)[\w-]+$/);
    tournamentUrl = page.url();

    await page.getByRole("tab", { name: /учасник/i }).click();
    await page.getByRole("combobox", { name: "Обрати гравців" }).click();
    await page.getByRole("option", { name: playerAName }).click();
    await page.getByRole("option", { name: playerBName }).click();
    await page.keyboard.press("Escape");

    // The roster list updates optimistically (near-instant), well before the
    // real mutation's response comes back - explicitly wait for that
    // response too, not just the UI, otherwise this test can finish (and
    // Playwright tears down the page) while the request is still in flight,
    // aborting it before it ever reaches the server.
    const [mutationResponse] = await Promise.all([
      page.waitForResponse((res) => res.url() === tournamentUrl && res.request().method() === "POST"),
      page.getByRole("button", { name: /Додати/ }).click(),
    ]);
    expect(mutationResponse.ok()).toBe(true);

    // The picked-but-not-yet-submitted players also show up as removable
    // badges right above the roster list, so scope to actual <li> rows.
    const roster = page.getByRole("tabpanel", { name: /учасник/i });
    await expect(roster.getByRole("listitem").filter({ hasText: playerAName })).toBeVisible();
    await expect(roster.getByRole("listitem").filter({ hasText: playerBName })).toBeVisible();
  });

  test("admin can create a match between the two participants", async ({ page }) => {
    await page.goto(tournamentUrl);
    await page.getByRole("tab", { name: /учасник/i }).click();
    const roster = page.getByRole("tabpanel", { name: /учасник/i });
    await expect(roster.getByRole("listitem").filter({ hasText: playerAName })).toBeVisible();

    await page.getByRole("tab", { name: /матч/i }).click();
    await page.getByRole("button", { name: "Додати матч" }).click();

    await page.getByRole("combobox", { name: "Сторона A" }).click();
    await page.getByRole("option", { name: playerAName }).click();
    await page.getByRole("combobox", { name: "Сторона B" }).click();
    await page.getByRole("option", { name: playerBName }).click();

    // Same reasoning as the participant add above: wait for the real
    // response, not just the optimistic UI update, before the test ends.
    const [mutationResponse] = await Promise.all([
      page.waitForResponse((res) => res.url() === tournamentUrl && res.request().method() === "POST"),
      page.getByRole("button", { name: "Створити матч" }).click(),
    ]);
    expect(mutationResponse.ok()).toBe(true);

    const matches = page.getByRole("tabpanel", { name: /матч/i });
    await expect(matches.getByText(playerAName)).toBeVisible();
    await expect(matches.getByText(playerBName)).toBeVisible();
  });

  test("admin can save a match score and see it marked completed", async ({ page }) => {
    await page.goto(tournamentUrl);
    await page.getByRole("tab", { name: /матч/i }).click();

    await page.getByRole("button", { name: "Рахунок" }).click();
    await page.getByLabel(`Сет 1, ${playerAName}`).fill("6");
    await page.getByLabel(`Сет 1, ${playerBName}`).fill("4");
    await page.getByRole("button", { name: "Зберегти рахунок" }).click();

    const matches = page.getByRole("tabpanel", { name: /матч/i });
    await expect(matches.getByText("Завершено")).toBeVisible({ timeout: 10000 });
  });

  // Ratings on /rating are always recomputed live from Match/MatchSet (see
  // docs/RATING.md - RatingSnapshot is only a cache for the history chart),
  // so the completed match from the previous test should show up here
  // immediately, no separate wait for a background snapshot rebuild needed.
  // Must run before the randomizer test below, which wipes this match.
  test("both players appear in the singles rating table after a completed match", async ({ page }) => {
    await page.goto("/rating");
    const table = page.getByRole("table");
    await expect(table.getByText(playerAName)).toBeVisible({ timeout: 10000 });
    await expect(table.getByText(playerBName)).toBeVisible({ timeout: 10000 });
  });

  test("admin can run the singles randomizer and replace matches with a fresh round robin", async ({
    page,
  }) => {
    await page.goto(tournamentUrl);
    await page.getByRole("tab", { name: /матч/i }).click();

    // Re-running it ("Рерандомайзер") after the match created above wipes
    // that match and replaces it with a fresh round robin.
    await page.getByRole("button", { name: "Рерандомайзер" }).click();
    await page.getByRole("button", { name: "Створити" }).click();

    // Two participants, "all vs all" -> exactly one match.
    await expect(page.getByRole("tab", { name: "1 матч" })).toBeVisible({ timeout: 10000 });
  });
});
