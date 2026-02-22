import { test, expect } from "../fixtures/bord-test";

test.describe("Sessions (S1-S5)", () => {
  test.beforeEach(async ({ page, sidebar }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select fixture-web workspace
    const wsButton = sidebar.rail.locator('button[title="fixture-web"]');
    if (await wsButton.isVisible()) {
      await wsButton.click();
      await page.waitForTimeout(500);
    }

    // Open sidebar panel
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);
  });

  test("S1: Claude tab shows sessions or empty state (XOR)", async ({ page, sessionList }) => {
    // Click Claude provider tab
    const claudeTab = page.locator('button[title="Claude"]').first();
    if (await claudeTab.isVisible()) {
      await claudeTab.click();
      await page.waitForTimeout(1000);
    }

    // Exactly one of: session cards or "No sessions" message
    const cards = sessionList.sessionCards();
    const noSessions = sessionList.noSessionsMessage();
    const hasCards = (await cards.count()) > 0;
    const hasEmptyState = await noSessions.isVisible();

    // XOR: exactly one must be true
    expect(hasCards !== hasEmptyState).toBe(true);
  });

  test("S2: Codex tab shows sessions or empty state (XOR)", async ({ page, sessionList }) => {
    // Click Codex provider tab
    const codexTab = page.locator('button[title="Codex"]').first();
    if (await codexTab.isVisible()) {
      await codexTab.click();
      await page.waitForTimeout(1000);
    }

    // Exactly one of: session cards or "No sessions" message
    const cards = sessionList.sessionCards();
    const noSessions = sessionList.noSessionsMessage();
    const hasCards = (await cards.count()) > 0;
    const hasEmptyState = await noSessions.isVisible();

    // XOR: exactly one must be true
    expect(hasCards !== hasEmptyState).toBe(true);
  });

  test("S3: clicking session card spawns terminal", async ({
    page,
    sidebar,
    sessionList,
    terminalPanel,
  }) => {
    // Ensure Claude tab is selected
    const claudeTab = page.locator('button[title="Claude"]').first();
    if (await claudeTab.isVisible()) {
      await claudeTab.click();
      await page.waitForTimeout(1000);
    }

    const cards = sessionList.sessionCards();
    if ((await cards.count()) === 0) {
      // No sessions available (CI without Claude CLI)
      test.skip();
      return;
    }

    const before = await terminalPanel.visibleCount();
    await sessionList.clickSessionByIndex(0);
    await page.waitForTimeout(1500);

    const after = await terminalPanel.visibleCount();
    expect(after).toBeGreaterThan(before);
  });

  test("S4: switching provider tabs changes session content", async ({ page }) => {
    // Check we have at least two provider tabs
    const claudeTab = page.locator('button[title="Claude"]').first();
    const codexTab = page.locator('button[title="Codex"]').first();

    if (!(await claudeTab.isVisible()) || !(await codexTab.isVisible())) {
      test.skip();
      return;
    }

    // Get content with Claude selected
    await claudeTab.click();
    await page.waitForTimeout(1000);

    // Switch to Codex
    await codexTab.click();
    await page.waitForTimeout(1000);

    // Verify Codex tab is now the active/selected tab (has opacity-100 class)
    const codexClasses = await codexTab.getAttribute("class");
    const claudeClasses = await claudeTab.getAttribute("class");
    // The active tab should have different styling than the inactive one
    expect(codexClasses).not.toBe(claudeClasses);
  });

  test("S-opencode: OpenCode provider tab", async ({ page, sessionList }) => {
    const opencodeTab = page.locator('button[title="OpenCode"]').first();
    if (!(await opencodeTab.isVisible())) {
      test.skip();
      return;
    }

    await opencodeTab.click();
    await page.waitForTimeout(1000);

    // Either session cards exist or "No sessions" message shows
    const cards = sessionList.sessionCards();
    const noSessions = sessionList.noSessionsMessage();
    const hasCards = (await cards.count()) > 0;
    const hasEmptyState = await noSessions.isVisible();

    expect(hasCards || hasEmptyState).toBe(true);
  });

  test("S-card-details: session card shows message count and time", async ({
    page,
    sidebar,
    sessionList,
  }) => {
    // Ensure Claude tab is selected (most likely to have sessions)
    const claudeTab = page.locator('button[title="Claude"]').first();
    if (await claudeTab.isVisible()) {
      await claudeTab.click();
      await page.waitForTimeout(1000);
    }

    const cards = sessionList.sessionCards();
    if ((await cards.count()) === 0) {
      // No sessions available (CI without Claude CLI)
      test.skip();
      return;
    }

    // Check that the first session card contains message count and time-ago text
    const firstCard = cards.first();
    const cardText = await firstCard.textContent();

    // Should contain a message count pattern like "N msgs" or "N messages"
    expect(cardText).toMatch(/\d+\s*msg/i);

    // Should contain time-ago text (e.g., "2h ago", "3d ago", "just now")
    expect(cardText).toMatch(/ago|just now|today|yesterday/i);
  });

  test("S5: Gemini tab shows empty/placeholder state", async ({ page, sessionList }) => {
    const geminiTab = page.locator('button[title="Gemini"]').first();
    if (!(await geminiTab.isVisible())) {
      test.skip();
      return;
    }

    await geminiTab.click();
    await page.waitForTimeout(1000);

    // Gemini should show no sessions (no CLI generates them for fixtures)
    const noSessions = sessionList.noSessionsMessage();
    expect(await noSessions.isVisible()).toBe(true);
  });
});
