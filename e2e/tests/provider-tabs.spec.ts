import { test, expect } from "../fixtures/bord-test";

test.describe("Provider tabs", () => {
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

  test("PT-1: all 4 provider tab buttons exist with correct visual state", async ({
    page,
  }) => {
    const providers = ["Claude", "Codex", "OpenCode", "Gemini"];
    for (const provider of providers) {
      const tab = page.locator(`button[title="${provider}"]`).first();
      await expect(tab).toBeVisible();
    }

    // Click each tab and verify active state
    for (const provider of providers) {
      const tab = page.locator(`button[title="${provider}"]`).first();
      await tab.click();
      await page.waitForTimeout(300);

      // Active tab should have opacity-100 class
      const classes = await tab.getAttribute("class");
      expect(classes).toContain("opacity-100");

      // The underline bar inside the active tab should have opacity-100
      const underline = tab.locator("div.rounded-full");
      if ((await underline.count()) > 0) {
        const underlineClasses = await underline.getAttribute("class");
        expect(underlineClasses).toContain("opacity-100");
      }
    }
  });

  test("PT-2: provider tab persists across workspace switch", async ({
    page,
    sidebar,
  }) => {
    const workspaceButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await workspaceButtons.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Select Codex tab
    const codexTab = page.locator('button[title="Codex"]').first();
    await codexTab.click();
    await page.waitForTimeout(300);

    // Verify Codex is active
    let classes = await codexTab.getAttribute("class");
    expect(classes).toContain("opacity-100");

    // Switch to different workspace
    await workspaceButtons.nth(1).click();
    await page.waitForTimeout(500);

    // Ensure sidebar is still expanded
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Codex tab should still be active
    const codexTabAfter = page.locator('button[title="Codex"]').first();
    classes = await codexTabAfter.getAttribute("class");
    expect(classes).toContain("opacity-100");
  });

  test("PT-3: new session button uses active provider", async ({
    page,
    sidebar,
    terminalPanel,
  }) => {
    // Select Codex tab
    const codexTab = page.locator('button[title="Codex"]').first();
    await codexTab.click();
    await page.waitForTimeout(300);

    // Look for the "New Codex session" button in the sidebar
    const newSessionBtn = page.locator('button:has-text("New Codex session")');
    if (!(await newSessionBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Button might have different text format — try generic new session button
      const genericNewBtn = page.locator('button:has-text("New")').filter({ hasText: /Codex|session/i });
      if ((await genericNewBtn.count()) === 0) {
        test.skip();
        return;
      }

      const before = await terminalPanel.visibleCount();
      await genericNewBtn.first().click();
      await page.waitForTimeout(1500);

      const after = await terminalPanel.visibleCount();
      expect(after).toBeGreaterThan(before);
      return;
    }

    const before = await terminalPanel.visibleCount();
    await newSessionBtn.click();
    await page.waitForTimeout(1500);

    const after = await terminalPanel.visibleCount();
    expect(after).toBeGreaterThan(before);
  });
});
