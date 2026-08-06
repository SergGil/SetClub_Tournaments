import { expect, test } from "@playwright/test";

// See admin-flows.spec.ts for the test-login/cleanup setup this shares.
const secret = process.env.E2E_TEST_LOGIN_SECRET;

test.describe("GROUPS_12_PLAYOFF randomizer flow", () => {
  test.skip(!secret, "E2E_TEST_LOGIN_SECRET not set - skipping authenticated admin tests");
  test.describe.configure({ mode: "serial" });

  const stamp = Date.now();
  const playerNames = Array.from({ length: 12 }, (_, i) => `Playwright G12 Player ${i + 1} ${stamp}`);
  const tournamentName = `Playwright G12 Playoff Cup ${stamp}`;
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

  test("admin creates 12 players, a tournament, and a 12-participant roster with 4 seeded", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/admin/players");
    const addPlayerDialogTitle = page.getByRole("heading", { name: "Додати гравця" });
    for (const name of playerNames) {
      await page.getByRole("button", { name: "Додати гравця" }).click();
      await addPlayerDialogTitle.waitFor();
      await page.getByLabel("Ім'я").fill(name);
      await page.getByRole("button", { name: "Створити" }).click();
      // The players list below is paginated ("Показано 20 з N") - the new
      // player can land past the first page, so don't wait on seeing it
      // there. The dialog closing is the actual success signal.
      await addPlayerDialogTitle.waitFor({ state: "hidden", timeout: 10000 });
    }

    await page.goto("/admin/tournaments/new");
    await page.getByLabel("Назва турніру").fill(tournamentName);
    await page.getByLabel("Дата початку").fill("2026-01-01");
    await page.getByLabel("Дата завершення").fill("2026-01-02");
    await page.getByRole("button", { name: "Створити турнір" }).click();
    await expect(page).toHaveURL(/\/admin\/tournaments\/(?!new$)[\w-]+$/);
    tournamentUrl = page.url();

    await page.getByRole("tab", { name: /учасник/i }).click();
    // addParticipantAction upserts each pick in one $transaction - against
    // the remote dev DB, batches much bigger than this can exceed Prisma's
    // 5s interactive-transaction timeout (a pre-existing limit, unrelated to
    // this feature - latency against the remote DB varies enough that even
    // 6 at once flakes sometimes), so add in small batches of 3.
    for (let i = 0; i < playerNames.length; i += 3) {
      const batch = playerNames.slice(i, i + 3);
      await page.getByRole("combobox", { name: "Обрати гравців" }).click();
      for (const name of batch) {
        await page.getByRole("option", { name }).click();
      }
      await page.keyboard.press("Escape");
      const [mutationResponse] = await Promise.all([
        page.waitForResponse((res) => res.url() === tournamentUrl && res.request().method() === "POST"),
        page.getByRole("button", { name: /Додати/ }).click(),
      ]);
      expect(mutationResponse.ok()).toBe(true);
    }

    const roster = page.getByRole("tabpanel", { name: /учасник/i });
    await expect(roster.getByRole("listitem").filter({ hasText: playerNames[11] })).toBeVisible({
      timeout: 10000,
    });

    // Exactly 4 seeded, as GROUPS_12_PLAYOFF requires. The "Сіяний" label
    // resolves to both Base UI's visible checkbox span and a hidden native
    // input mirroring it for form semantics - .first() is the visible one.
    // toggleParticipantSeedAction fires from startTransition, not awaited by
    // the click itself - explicitly wait for its real response each time
    // (same reasoning as the participant-add above), or the next test's
    // page navigation can abort it mid-flight before it ever reaches the
    // server, leaving seed=null despite the optimistic checkbox looking checked.
    for (const name of playerNames.slice(0, 4)) {
      const row = roster.getByRole("listitem").filter({ hasText: name });
      const [seedResponse] = await Promise.all([
        page.waitForResponse((res) => res.url() === tournamentUrl && res.request().method() === "POST"),
        row.getByLabel("Сіяний").first().click(),
      ]);
      expect(seedResponse.ok()).toBe(true);
    }
    for (const name of playerNames.slice(0, 4)) {
      const row = roster.getByRole("listitem").filter({ hasText: name });
      await expect(row.getByLabel("Сіяний").first()).toHaveAttribute("aria-checked", "true");
    }
  });

  test("admin runs the GROUPS_12_PLAYOFF randomizer and it creates all 30 matches", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(tournamentUrl);
    await page.getByRole("tab", { name: /матч/i }).click();

    await page.getByRole("button", { name: "Рандомайзер" }).click();
    await page.getByRole("combobox", { name: "Логіка формування матчів" }).click();
    await page.getByRole("option", { name: /плей-офф/ }).click();
    await expect(page.getByText(/буде створено 30 матчів/)).toBeVisible();
    await page.getByRole("button", { name: "Створити" }).click();

    // Draw-reveal animates one player at a time (~1.5s each, 12 players) before committing.
    await expect(page.getByRole("tab", { name: "30 матчів" })).toBeVisible({ timeout: 30000 });
  });

  test("completing a group's 3 matches auto-fills its rank-1 and rank-2 players into separate 1/4 matches", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto(tournamentUrl);
    await page.getByRole("tab", { name: /матч/i }).click();
    const matches = page.getByRole("tabpanel", { name: /матч/i });

    // Discover one group's 3 matches by finding 3 rows that share a round
    // Badge reading "Група X" - any of the 4 works the same way structurally.
    let groupRows = matches.locator("div.flex.flex-col.gap-2.sm\\:flex-row").filter({ hasText: "Група A" });
    if ((await groupRows.count()) !== 3) {
      for (const l of ["B", "C", "D"]) {
        const rows = matches.locator("div.flex.flex-col.gap-2.sm\\:flex-row").filter({ hasText: `Група ${l}` });
        if ((await rows.count()) === 3) {
          groupRows = rows;
          break;
        }
      }
    }
    expect(await groupRows.count()).toBe(3);

    // Figure out which 3 of our 12 known player names appear in this group,
    // and each row's exact pairing - captured upfront, positionally, before
    // any score is saved. Scoring a match can move its row within the list
    // (e.g. once it's COMPLETED), so re-locating by position mid-loop would
    // drift onto the wrong row; re-locating by this stable (nameA, nameB)
    // pair instead is immune to that.
    const pairs: [string, string][] = [];
    for (let i = 0; i < 3; i++) {
      const text = (await groupRows.nth(i).innerText()).replace(/\s+/g, " ");
      const found = playerNames.filter((name) => text.includes(name));
      expect(found).toHaveLength(2);
      pairs.push([found[0], found[1]]);
    }
    const members = [...new Set(pairs.flat())];
    expect(members).toHaveLength(3);
    const [sorted1, sorted2, sorted3] = [...members].sort();

    // Deterministic round robin: alphabetically-first name always wins ->
    // sorted1 goes 2-0 (rank 1), sorted2 goes 1-1 (rank 2), sorted3 0-2 (rank 3).
    for (const [nameA, nameB] of pairs) {
      const [winner, loser] = nameA < nameB ? [nameA, nameB] : [nameB, nameA];
      const row = matches
        .locator("div.flex.flex-col.gap-2.sm\\:flex-row")
        .filter({ hasText: "Група" })
        .filter({ hasText: nameA })
        .filter({ hasText: nameB });
      await expect(row).toHaveCount(1);
      await row.getByRole("button", { name: "Рахунок" }).click();
      const dialogTitle = page.getByRole("heading", { name: "Рахунок матчу" });
      await dialogTitle.waitFor();
      await page.getByLabel(`Сет 1, ${winner}`).fill("6");
      await page.getByLabel(`Сет 1, ${loser}`).fill("2");
      await page.getByRole("button", { name: "Зберегти рахунок" }).click();
      await dialogTitle.waitFor({ state: "hidden", timeout: 10000 });
      // Let the reset/refresh from this save settle before locating the next row by content.
      await page.waitForTimeout(500);
    }

    // Give the resolver's revalidatePath a moment, then reload for a clean read.
    await page.waitForTimeout(1500);
    await page.reload();
    await page.getByRole("tab", { name: /матч/i }).click();

    const quarterfinalRows = matches
      .locator("div.flex.flex-col.gap-2.sm\\:flex-row")
      .filter({ hasText: "1/4" });
    const qfCount = await quarterfinalRows.count();
    let sawRank1 = false;
    let sawRank2 = false;
    for (let i = 0; i < qfCount; i++) {
      const text = (await quarterfinalRows.nth(i).innerText()).replace(/\s+/g, " ");
      if (text.includes(sorted1)) sawRank1 = true;
      if (text.includes(sorted2)) sawRank2 = true;
      // The rank-3 finisher never advances to the playoff bracket at all.
      expect(text.includes(sorted3)).toBe(false);
    }
    expect(sawRank1, `expected a 1/4 match to already show ${sorted1} (group rank 1)`).toBe(true);
    expect(sawRank2, `expected a different 1/4 match to already show ${sorted2} (group rank 2)`).toBe(true);
  });
});
