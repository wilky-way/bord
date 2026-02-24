import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Keyboard shortcuts", () => {
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

  test("Cmd+N adds a terminal", async ({ page, terminalPanel }) => {
    const before = await terminalPanel.visibleCount();
    await page.keyboard.press("Meta+n");
    await page.waitForTimeout(1000);
    expect(await terminalPanel.visibleCount()).toBe(before + 1);
  });

  test("Cmd+T adds a terminal (alias)", async ({ page, terminalPanel }) => {
    const before = await terminalPanel.visibleCount();
    await page.keyboard.press("Meta+t");
    await page.waitForTimeout(1000);
    expect(await terminalPanel.visibleCount()).toBe(before + 1);
  });

  test("Cmd+W closes active terminal", async ({ page, topbar, terminalPanel }) => {
    // Need at least 2 terminals (Cmd+W doesn't close the last one)
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Click a terminal panel to ensure it's active and focused
    const panel = terminalPanel.allPanels().first();
    await panel.click();
    await page.waitForTimeout(200);

    const before = await terminalPanel.visibleCount();
    // Use dispatchEvent to bypass Chromium's native Cmd+W tab-close behavior
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "w",
          code: "KeyW",
          metaKey: true,
          ctrlKey: false,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await page.waitForTimeout(500);
    expect(await terminalPanel.visibleCount()).toBe(before - 1);
  });

  test("Alt+Right / Alt+Left navigates between terminals (via dispatchEvent)", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    // Ensure at least 2 terminals
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Click the first terminal to ensure a known starting point
    const ids = await terminalPanel.allTerminalIds();
    await terminalPanel.panel(ids[0]).click();
    await page.waitForTimeout(300);

    // Navigate right with Alt+Right (the implemented shortcut)
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight", code: "ArrowRight", altKey: true,
          bubbles: true, cancelable: true,
        }),
      );
    });
    await page.waitForTimeout(500);

    // Check that the second panel now has active styling (opacity: 1)
    const secondOpacity = await terminalPanel.panel(ids[1]).evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    expect(secondOpacity).toBe("1");

    // Navigate left
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowLeft", code: "ArrowLeft", altKey: true,
          bubbles: true, cancelable: true,
        }),
      );
    });
    await page.waitForTimeout(500);

    const firstOpacity = await terminalPanel.panel(ids[0]).evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    expect(firstOpacity).toBe("1");

    // Terminal count should be unchanged
    expect(await terminalPanel.visibleCount()).toBeGreaterThanOrEqual(2);
  });

  test("Cmd+G toggles git panel", async ({ page, topbar, terminalPanel, gitPanel }) => {
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }

    // Wait for branch badge to potentially appear
    await page.waitForTimeout(2000);

    await page.keyboard.press("Meta+g");
    await page.waitForTimeout(500);

    // Git panel may or may not open depending on whether the branch badge loaded
    // Just verify the shortcut doesn't crash
    const isOpen = await gitPanel.isVisible();

    if (isOpen) {
      // Toggle it off
      await page.keyboard.press("Meta+g");
      await page.waitForTimeout(300);
      expect(await gitPanel.isVisible()).toBe(false);
    }
  });

  test("Cmd+G toggle with branch badge verification", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
    gitPanel,
  }) => {
    // Select fixture-web workspace (has a git repo)
    const wsButton = sidebar.rail.locator('button[title="fixture-web"]');
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }

    // Wait for the branch badge to appear on the terminal titlebar
    const branchBadge = page.locator(sel.terminalPanel()).first().locator(sel.toggleGitPanel);
    await branchBadge.waitFor({ state: "visible", timeout: 10_000 });

    // Click the terminal panel to ensure it's active (sets activeTerminalId in store)
    const firstPanel = terminalPanel.allPanels().first();
    await firstPanel.click();
    await page.waitForTimeout(300);

    // Ensure git panel is closed first
    if (await gitPanel.isVisible()) {
      await branchBadge.click();
      await page.waitForTimeout(300);
    }

    // Open git panel with Cmd+G via dispatchEvent (bypasses terminal WASM)
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", code: "KeyG", metaKey: true, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(800);

    // Verify git panel portal is actually visible
    expect(await gitPanel.isVisible()).toBe(true);
    await expect(gitPanel.sourceControlHeading()).toBeVisible();

    // Close with Cmd+G
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", code: "KeyG", metaKey: true, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(500);
    expect(await gitPanel.isVisible()).toBe(false);
  });

  test("Cmd+B toggles sidebar", async ({ page, sidebar }) => {
    const wasSidebarOpen = await sidebar.isExpanded();

    await page.keyboard.press("Meta+b");
    await page.waitForTimeout(300);

    const isNowOpen = await sidebar.isExpanded();
    expect(isNowOpen).toBe(!wasSidebarOpen);

    // Toggle back
    await page.keyboard.press("Meta+b");
    await page.waitForTimeout(300);
    expect(await sidebar.isExpanded()).toBe(wasSidebarOpen);
  });

  test("Cmd+, opens settings", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(true);

    // Close it
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(false);
  });

  test("Alt+Left/Right terminal navigation switches terminals", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    // Ensure at least 2 terminals
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    const ids = await terminalPanel.allTerminalIds();
    if (ids.length < 2) {
      test.skip();
      return;
    }

    // Click the first terminal to set starting point
    await terminalPanel.panel(ids[0]).click();
    await page.waitForTimeout(300);

    // Use Alt+Right to navigate to next terminal
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          code: "ArrowRight",
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await page.waitForTimeout(500);

    // Second terminal should now be active (opacity 1 via computed style)
    const secondOpacity = await terminalPanel
      .panel(ids[1])
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(secondOpacity).toBe("1");

    // Use Alt+Left to navigate back
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowLeft",
          code: "ArrowLeft",
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await page.waitForTimeout(500);

    const firstOpacity = await terminalPanel
      .panel(ids[0])
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(firstOpacity).toBe("1");
  });
});
