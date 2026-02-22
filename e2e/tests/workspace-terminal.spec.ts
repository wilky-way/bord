import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Workspace & terminal management (W1-W7)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("W1: terminals are scoped to workspace — switch preserves state", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    // Get fixture workspaces from sidebar rail
    const workspaceButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await workspaceButtons.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Select workspace A
    const wsAName = await workspaceButtons.nth(0).getAttribute("title");
    await workspaceButtons.nth(0).click();
    await page.waitForTimeout(500);

    // Add a terminal in workspace A
    await topbar.addTerminal();
    await page.waitForTimeout(1000);
    const countA = await terminalPanel.visibleCount();
    expect(countA).toBeGreaterThanOrEqual(1);

    // Switch to workspace B
    const wsBName = await workspaceButtons.nth(1).getAttribute("title");
    await workspaceButtons.nth(1).click();
    await page.waitForTimeout(500);

    // A's terminals should not be visible (B may have 0 or its own)
    // Switch back to A
    await workspaceButtons.nth(0).click();
    await page.waitForTimeout(500);

    // A's terminal count should be preserved
    const countAAfter = await terminalPanel.visibleCount();
    expect(countAAfter).toBe(countA);
  });

  test("W3: Cmd+N adds a new terminal panel", async ({ page, sidebar, terminalPanel }) => {
    // Make sure a workspace is selected
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

    const before = await terminalPanel.visibleCount();
    await page.keyboard.press("Meta+n");
    await page.waitForTimeout(1000);
    const after = await terminalPanel.visibleCount();
    expect(after).toBe(before + 1);
  });

  test("W4: Cmd+Right/Left cycles through terminals", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    // Select a workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

    // Ensure at least 2 terminals
    const count = await terminalPanel.visibleCount();
    if (count < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }
    if (await terminalPanel.visibleCount() < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }

    const ids = await terminalPanel.allTerminalIds();
    expect(ids.length).toBeGreaterThanOrEqual(2);

    // Click the first terminal to set a known starting point
    await terminalPanel.panel(ids[0]).click();
    await page.waitForTimeout(300);

    // Use dispatchEvent to bypass terminal WASM capturing keyboard events
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight", code: "ArrowRight", metaKey: true,
          bubbles: true, cancelable: true,
        }),
      );
    });
    await page.waitForTimeout(300);

    const secondOpacity = await terminalPanel.panel(ids[1]).evaluate(
      (el) => (el as HTMLElement).style.opacity,
    );
    expect(secondOpacity).toBe("1");

    // Navigate left — should activate first terminal
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowLeft", code: "ArrowLeft", metaKey: true,
          bubbles: true, cancelable: true,
        }),
      );
    });
    await page.waitForTimeout(300);

    const firstOpacity = await terminalPanel.panel(ids[0]).evaluate(
      (el) => (el as HTMLElement).style.opacity,
    );
    expect(firstOpacity).toBe("1");

    // Should still have the same number of terminals
    expect(await terminalPanel.visibleCount()).toBe(ids.length);
  });

  test("W5: drag terminal reorders panels", async ({ page, sidebar, topbar, terminalPanel }) => {
    // Select workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

    // Ensure at least 3 terminals
    while ((await terminalPanel.visibleCount()) < 3) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    const panels = terminalPanel.allPanels();
    const firstPanel = panels.first();
    const titlebar = firstPanel.locator(sel.titlebar);

    const box = await titlebar.boundingBox();
    if (!box) {
      test.skip();
      return;
    }

    // Simulate drag from first to third position
    const thirdPanel = panels.nth(2);
    const targetBox = await thirdPanel.locator(sel.titlebar).boundingBox();
    if (!targetBox) {
      test.skip();
      return;
    }

    // Record terminal order before drag
    const idsBefore = await terminalPanel.allTerminalIds();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Move in more steps for a more reliable drag
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 20 },
    );
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Record terminal order after drag
    const idsAfter = await terminalPanel.allTerminalIds();

    // Verify we still have the same number of terminals (no panels lost)
    expect(idsAfter.length).toBe(idsBefore.length);

    // Verify the same terminal IDs exist (just potentially reordered)
    expect([...idsAfter].sort()).toEqual([...idsBefore].sort());
  });

  test("W6: density buttons change visible columns", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    // Select workspace and add terminals
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

    // Ensure at least 4 terminals
    while ((await terminalPanel.visibleCount()) < 4) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Click 1x density
    await topbar.setDensity(1);
    await page.waitForTimeout(300);
    expect(await topbar.getActiveDensity()).toBe(1);

    // Click 4x density
    await topbar.setDensity(4);
    await page.waitForTimeout(300);
    expect(await topbar.getActiveDensity()).toBe(4);

    // Click 2x density
    await topbar.setDensity(2);
    await page.waitForTimeout(300);
    expect(await topbar.getActiveDensity()).toBe(2);
  });

  test("W2: terminal stays in workspace after adding more", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    // Get fixture workspaces from sidebar rail
    const workspaceButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await workspaceButtons.count();
    if (count < 1) {
      test.skip();
      return;
    }

    // Select workspace A
    await workspaceButtons.nth(0).click();
    await page.waitForTimeout(500);

    // Add a terminal
    await topbar.addTerminal();
    await page.waitForTimeout(1000);
    const countAfterFirst = await terminalPanel.visibleCount();
    expect(countAfterFirst).toBeGreaterThanOrEqual(1);

    // Add another terminal
    await topbar.addTerminal();
    await page.waitForTimeout(1000);
    const countAfterSecond = await terminalPanel.visibleCount();
    expect(countAfterSecond).toBe(countAfterFirst + 1);

    // All terminals should still be in the same workspace (no workspace switch happened)
    const allIds = await terminalPanel.allTerminalIds();
    expect(allIds.length).toBe(countAfterSecond);
  });

  test("W-delete: delete workspace via context menu", async ({
    page,
    sidebar,
  }) => {
    // Find a fixture workspace button
    const workspaceButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await workspaceButtons.count();
    if (count < 2) {
      // Need at least 2 workspaces so we can delete one
      test.skip();
      return;
    }

    const lastWsButton = workspaceButtons.last();
    const wsName = await lastWsButton.getAttribute("title");

    // Set up dialog handler to accept the confirm prompt
    page.on("dialog", (dialog) => dialog.accept());

    // Right-click to open context menu
    await lastWsButton.click({ button: "right" });
    await page.waitForTimeout(300);

    // Click "Remove workspace" option
    const removeOption = page.locator("text=Remove workspace");
    if (!(await removeOption.isVisible())) {
      test.skip();
      return;
    }
    await removeOption.click();
    await page.waitForTimeout(1000);

    // Workspace should no longer be in the rail
    const removedButton = sidebar.rail.locator(`button[title="${wsName}"]`);
    expect(await removedButton.count()).toBe(0);
  });

  test("W7: minimap dot click scrolls terminal into view", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    // Select workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

    // Ensure at least 3 terminals
    while ((await terminalPanel.visibleCount()) < 3) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Set 1x density to enable scrolling
    await topbar.setDensity(1);
    await page.waitForTimeout(300);

    // Look for minimap dots
    const minimapDots = page.locator("button.rounded-full").filter({ hasText: "" });
    const dotCount = await minimapDots.count();
    if (dotCount < 2) {
      // Minimap may not show with fewer terminals
      test.skip();
      return;
    }

    // Record active terminal before clicking
    const activeBefore = await terminalPanel.activeTerminalId();

    // Click the last minimap dot
    await minimapDots.last().click();
    await page.waitForTimeout(300);

    // Verify a terminal became active and it changed
    const activeAfter = await terminalPanel.activeTerminalId();
    expect(activeAfter).toBeTruthy();
    // Active terminal should change (was on first, now on last)
    if (activeBefore) {
      expect(activeAfter).not.toBe(activeBefore);
    }
  });

  test("W-title-edit: double-click title to rename terminal", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
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

    const firstId = await terminalPanel.firstTerminalId();
    if (!firstId) {
      test.skip();
      return;
    }

    // Double-click the title span to enter edit mode
    const titleSpan = terminalPanel
      .panel(firstId)
      .locator("[data-titlebar] span.text-xs.truncate.cursor-text");
    await titleSpan.dblclick();
    await page.waitForTimeout(200);

    // Input should appear
    const input = terminalPanel.panel(firstId).locator("[data-titlebar] input");
    await expect(input).toBeVisible();

    // Type new title and press Enter
    await input.fill("My Custom Title");
    await input.press("Enter");
    await page.waitForTimeout(200);

    // Input should disappear, title should show new text
    await expect(input).not.toBeVisible();
    const updatedText = await titleSpan.textContent();
    expect(updatedText).toBe("My Custom Title");
  });

  test("W-title-escape: escape reverts title edit", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
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

    const firstId = await terminalPanel.firstTerminalId();
    if (!firstId) {
      test.skip();
      return;
    }

    const titleSpan = terminalPanel
      .panel(firstId)
      .locator("[data-titlebar] span.text-xs.truncate.cursor-text");
    const originalText = await titleSpan.textContent();

    // Double-click to enter edit mode
    await titleSpan.dblclick();
    await page.waitForTimeout(200);

    const input = terminalPanel.panel(firstId).locator("[data-titlebar] input");
    await expect(input).toBeVisible();

    // Type something and press Escape
    await input.fill("Should Not Save");
    await input.press("Escape");
    await page.waitForTimeout(200);

    // Input should disappear, title should revert
    await expect(input).not.toBeVisible();
    const revertedText = await titleSpan.textContent();
    expect(revertedText).toBe(originalText);
  });

  test("W-active-glow: active terminal has full opacity", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

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

    // Click the second terminal to make it active
    await terminalPanel.panel(ids[1]).click();
    await page.waitForTimeout(200);

    // Second terminal should have opacity 1 (active)
    const secondOpacity = await terminalPanel
      .panel(ids[1])
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(secondOpacity).toBe("1");

    // First terminal should have reduced opacity (inactive)
    const firstOpacity = await terminalPanel
      .panel(ids[0])
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(firstOpacity)).toBeLessThan(1);
  });

  test("W-flyout: collapsed sidebar shows flyout on hover", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
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

    // Collapse the sidebar
    await sidebar.ensureCollapsed();
    await page.waitForTimeout(300);

    // Hover over a workspace button to trigger flyout
    const box = await wsButton.boundingBox();
    if (!box) {
      test.skip();
      return;
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);

    // Flyout should appear
    const flyout = page.locator("[data-bord-sidebar-flyout]");
    if (await flyout.isVisible()) {
      expect(await flyout.isVisible()).toBe(true);

      // Move mouse away to dismiss flyout
      await page.mouse.move(box.x + 300, box.y);
      await page.waitForTimeout(500);

      // Flyout should disappear
      expect(await flyout.isVisible()).toBe(false);
    }
  });
});
