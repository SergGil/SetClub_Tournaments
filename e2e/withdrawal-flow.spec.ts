import { expect, test } from "@playwright/test";

// See admin-flows.spec.ts for the test-login/cleanup setup this shares.
const secret = process.env.E2E_TEST_LOGIN_SECRET;

test.describe("withdrawal (walkover) and tournament reset flow", () => {
  test.skip(!secret, "E2E_TEST_LOGIN_SECRET not set - skipping authenticated admin tests");
  test.describe.configure({ mode: "serial" });

  const stamp = Date.now();
  const playerAName = `Playwright Withdraw A ${stamp}`;
  const playerBName = `Playwright Withdraw B ${stamp}`;
  const tournamentName = `Playwright Withdraw Cup ${stamp}`;
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

  test("admin sets up a singles tournament with a scheduled match between two participants", async ({
    page,
  }) => {
    await page.goto("/admin/players");
    for (const name of [playerAName, playerBName]) {
      await page.getByRole("button", { name: "Додати гравця" }).click();
      await page.getByLabel("Ім'я").fill(name);
      await page.getByRole("button", { name: "Створити" }).click();
      // The club already has 20+ real players, so a freshly-created one can
      // land past the default page's cutoff (behind "Завантажити ще") -
      // search for it by name instead of relying on it being in the first
      // unfiltered page.
      await page.getByRole("searchbox", { name: "Пошук за іменем чи email" }).fill(name);
      await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
      await page.getByRole("searchbox", { name: "Пошук за іменем чи email" }).fill("");
    }

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
    const [addResponse] = await Promise.all([
      page.waitForResponse((res) => res.url() === tournamentUrl && res.request().method() === "POST"),
      page.getByRole("button", { name: /Додати/ }).click(),
    ]);
    expect(addResponse.ok()).toBe(true);

    await page.getByRole("tab", { name: /матч/i }).click();
    await page.getByRole("button", { name: "Додати матч" }).click();
    await page.getByRole("combobox", { name: "Сторона A" }).click();
    await page.getByRole("option", { name: playerAName }).click();
    await page.getByRole("combobox", { name: "Сторона B" }).click();
    await page.getByRole("option", { name: playerBName }).click();
    const [matchResponse] = await Promise.all([
      page.waitForResponse((res) => res.url() === tournamentUrl && res.request().method() === "POST"),
      page.getByRole("button", { name: "Створити матч" }).click(),
    ]);
    expect(matchResponse.ok()).toBe(true);
  });

  test("withdrawing a participant closes their scheduled match as a walkover win for the opponent", async ({
    page,
  }) => {
    await page.goto(tournamentUrl);
    await page.getByRole("tab", { name: /учасник/i }).click();
    const roster = page.getByRole("tabpanel", { name: /учасник/i });
    const playerARow = roster.getByRole("listitem").filter({ hasText: playerAName });
    await expect(playerARow).toBeVisible();

    await playerARow.getByRole("button", { name: "Зняти з турніру" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    // No downstream bracket to cascade-reset in a plain 2-player tournament -
    // the submit button should already be enabled without typing a confirm word.
    const [withdrawResponse] = await Promise.all([
      page.waitForResponse((res) => res.url() === tournamentUrl && res.request().method() === "POST"),
      dialog.getByRole("button", { name: "Зняти з турніру" }).click(),
    ]);
    expect(withdrawResponse.ok()).toBe(true);

    // The withdrawn participant stays on the roster, marked "Знявся".
    await expect(playerARow.getByText("Знявся")).toBeVisible({ timeout: 10000 });

    // Their scheduled match auto-closed as a technical loss in the opponent's favor.
    await page.getByRole("tab", { name: /матч/i }).click();
    const matches = page.getByRole("tabpanel", { name: /матч/i });
    await expect(matches.getByText("Завершено")).toBeVisible({ timeout: 10000 });
    await expect(matches.getByText("Технічна поразка")).toBeVisible();
  });

  test("the withdrawn player takes no personal loss, and their real rating is untouched", async ({
    page,
  }) => {
    // docs/WITHDRAWAL.md: a walkover excludes both sides from rating
    // entirely, and must not count as a personal loss for the withdrawn
    // side - neither player has any other completed (non-walkover) match,
    // so neither should appear in the singles rating table at all.
    await page.goto("/rating");
    const table = page.getByRole("table");
    await expect(table.getByText(playerAName)).not.toBeVisible();
    await expect(table.getByText(playerBName)).not.toBeVisible();
  });

  test("admin can reset the tournament after a withdrawal without a server error", async ({ page }) => {
    await page.goto(tournamentUrl);
    page.on("response", (res) => {
      expect(res.status(), `unexpected ${res.status()} from ${res.url()}`).toBeLessThan(500);
    });

    await page.getByRole("button", { name: "Обнулити турнір" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    const confirmBox = dialog.getByRole("textbox");
    if (await confirmBox.isVisible().catch(() => false)) {
      await confirmBox.fill("ВИДАЛИТИ");
    }
    const [resetResponse] = await Promise.all([
      page.waitForResponse((res) => res.url() === tournamentUrl && res.request().method() === "POST"),
      dialog.getByRole("button", { name: "Обнулити" }).click(),
    ]);
    expect(resetResponse.ok()).toBe(true);
    await expect(dialog).not.toBeVisible();

    // Matches are gone, but the roster (including the withdrawn participant)
    // stays - see resetTournamentAction's doc comment in tournaments.ts.
    await expect(page.getByRole("tab", { name: "0 матчів" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("tab", { name: /учасник/i }).click();
    const roster = page.getByRole("tabpanel", { name: /учасник/i });
    await expect(roster.getByText(playerAName)).toBeVisible();
    await expect(roster.getByText(playerBName)).toBeVisible();
  });
});
