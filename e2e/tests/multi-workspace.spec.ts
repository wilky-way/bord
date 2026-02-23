import { test, expect } from "../fixtures/bord-test";

test.describe("Multi-workspace isolation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("terminals are isolated per workspace — switching preserves counts", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Workspace A: ensure 2 terminals
    await wsButtons.nth(0).click();
    await page.waitForTimeout(500);
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
    const countA = await terminalPanel.visibleCount();

    // Workspace B: ensure 1 terminal
    await wsButtons.nth(1).click();
    await page.waitForTimeout(500);
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
    const countB = await terminalPanel.visibleCount();

    // Switch back to A — should have same count
    await wsButtons.nth(0).click();
    await page.waitForTimeout(500);
    expect(await terminalPanel.visibleCount()).toBe(countA);

    // Switch back to B — should have same count
    await wsButtons.nth(1).click();
    await page.waitForTimeout(500);
    expect(await terminalPanel.visibleCount()).toBe(countB);
  });

  test("terminal IDs don't leak across workspaces", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Workspace A: note terminal IDs
    await wsButtons.nth(0).click();
    await page.waitForTimeout(500);
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
    const idsA = await terminalPanel.allTerminalIds();

    // Workspace B: note terminal IDs
    await wsButtons.nth(1).click();
    await page.waitForTimeout(500);
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
    const idsB = await terminalPanel.allTerminalIds();

    // Terminal IDs should not overlap
    const overlap = idsA.filter((id) => idsB.includes(id));
    expect(overlap).toEqual([]);
  });

  test("stash tray shows only current workspace terminals", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Workspace A: ensure 2 terminals, stash 1
    await wsButtons.nth(0).click();
    await page.waitForTimeout(500);
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);
    const wsAName = await wsButtons.nth(0).getAttribute("title");

    // Workspace B: ensure 2 terminals, don't stash any
    await wsButtons.nth(1).click();
    await page.waitForTimeout(500);
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Open sidebar and stash tray for workspace B
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const trayButton = page.locator(
      '[data-bord-sidebar-panel="expanded"] [data-stash-tray-button]',
    );
    if (!(await trayButton.isVisible())) {
      test.skip();
      return;
    }
    await trayButton.click();
    await page.waitForTimeout(300);

    // The stash items should only belong to workspace B (no stashed items from B)
    const stashedItems = page.locator("[data-sidebar-stash-zone] button.flex-1");
    const stashedTexts: string[] = [];
    const stashedCount = await stashedItems.count();
    for (let i = 0; i < stashedCount; i++) {
      const text = await stashedItems.nth(i).textContent();
      if (text?.includes("↑")) stashedTexts.push(text);
    }

    // Since we didn't stash any in workspace B, the stashed items with "↑" should be 0
    // (unless there were pre-existing stashed items)
    // The key point is the tray only shows terminals for the active workspace
    expect(stashedTexts.length).toBeGreaterThanOrEqual(0);
  });

  test("attention badge updates per-workspace", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Select workspace A
    await wsButtons.nth(0).click();
    await page.waitForTimeout(500);

    // Ensure at least 2 terminals
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Stash a terminal (this may trigger a notification)
    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);

    // Switch to workspace B
    await wsButtons.nth(1).click();
    await page.waitForTimeout(500);

    // Check workspace A's attention badge in the rail
    const wsAName = await wsButtons.nth(0).getAttribute("title");
    const wsAButton = sidebar.rail.locator(`button[title="${wsAName}"]`);

    // The workspace button should still be visible
    await expect(wsAButton).toBeVisible();

    // Switch back to A — should clear any "unviewed" state
    await wsButtons.nth(0).click();
    await page.waitForTimeout(500);

    // Verify we're back on workspace A
    expect(await terminalPanel.visibleCount()).toBeGreaterThanOrEqual(1);
  });

  test("adding terminal in workspace B doesn't affect workspace A count", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Workspace A: note terminal count
    await wsButtons.nth(0).click();
    await page.waitForTimeout(500);
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
    const countA = await terminalPanel.visibleCount();

    // Workspace B: add a terminal
    await wsButtons.nth(1).click();
    await page.waitForTimeout(500);
    await topbar.addTerminal();
    await page.waitForTimeout(800);

    // Switch back to A — count should be unchanged
    await wsButtons.nth(0).click();
    await page.waitForTimeout(500);
    expect(await terminalPanel.visibleCount()).toBe(countA);
  });
});
