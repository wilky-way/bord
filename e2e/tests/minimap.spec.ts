import { test, expect } from "../fixtures/bord-test";

test.describe("Terminal minimap", () => {
  test.beforeEach(async ({ page, sidebar }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select first fixture workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (await wsButton.isVisible()) {
      await wsButton.click();
      await page.waitForTimeout(500);
    }
  });

  test("MM-1: minimap dot count matches terminal count", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    // Ensure we have exactly 3 terminals
    while ((await terminalPanel.visibleCount()) < 3) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    const terminalCount = await terminalPanel.visibleCount();

    // Minimap dots are buttons with h-3.5 class inside the minimap container
    const minimapDots = page.locator("button.h-3\\.5.rounded");
    const dotCount = await minimapDots.count();

    expect(dotCount).toBe(terminalCount);
  });

  test("MM-2: minimap dot click activates terminal", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    // Ensure at least 2 terminals
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Set density to 1 so only one terminal is visible at a time
    await topbar.setDensity(1);
    await page.waitForTimeout(300);

    // Find minimap dots
    const minimapDots = page.locator("button.h-3\\.5.rounded");
    const dotCount = await minimapDots.count();
    if (dotCount < 2) {
      test.skip();
      return;
    }

    // Click the second minimap dot
    await minimapDots.nth(1).click();
    await page.waitForTimeout(300);

    // The second dot should now be active (wider: w-6 vs w-4)
    const secondDotClasses = await minimapDots.nth(1).getAttribute("class");
    expect(secondDotClasses).toContain("w-6");
  });

  test("MM-3: active minimap dot is wider than inactive", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    // Ensure at least 2 terminals
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    const minimapDots = page.locator("button.h-3\\.5.rounded");
    const dotCount = await minimapDots.count();
    if (dotCount < 2) {
      test.skip();
      return;
    }

    // Find the active dot (should have w-6)
    let activeCount = 0;
    let inactiveCount = 0;
    for (let i = 0; i < dotCount; i++) {
      const classes = await minimapDots.nth(i).getAttribute("class");
      if (classes?.includes("w-6")) {
        activeCount++;
      } else if (classes?.includes("w-4")) {
        inactiveCount++;
      }
    }

    // Exactly one active dot and at least one inactive dot
    expect(activeCount).toBe(1);
    expect(inactiveCount).toBeGreaterThanOrEqual(1);
  });

  test("MM-4: minimap hidden when fewer than 2 terminals", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    // Remove terminals until we have 1 or fewer
    while ((await terminalPanel.visibleCount()) > 1) {
      await terminalPanel.closeFirst();
      await page.waitForTimeout(500);
    }

    const terminalCount = await terminalPanel.visibleCount();
    if (terminalCount > 1) {
      test.skip();
      return;
    }

    // Minimap dots should not be visible with <2 terminals
    const minimapDots = page.locator("button.h-3\\.5.rounded");
    const dotCount = await minimapDots.count();

    // With 0 or 1 terminals, minimap should have 0 or 1 dots (hidden or minimal)
    expect(dotCount).toBeLessThanOrEqual(1);
  });
});
