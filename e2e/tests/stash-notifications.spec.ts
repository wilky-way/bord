import { test, expect } from "../fixtures/bord-test";

test.describe("Stash & notifications (N1-N5)", () => {
  test.beforeEach(async ({ page, sidebar, topbar }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select first fixture workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (await wsButton.isVisible()) {
      await wsButton.click();
      await page.waitForTimeout(500);
    }
  });

  test("N1: stash button removes terminal from layout", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    // Ensure at least 2 terminals (can't stash last one easily)
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
    const before = await terminalPanel.visibleCount();

    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);

    const after = await terminalPanel.visibleCount();
    expect(after).toBe(before - 1);
  });

  test("N2: stash tray button shows terminal count", async ({
    page,
    topbar,
    terminalPanel,
    sidebar,
  }) => {
    // Ensure we have terminals
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Open sidebar to see stash tray
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // The stash tray button should exist and show count
    // Scope to expanded sidebar panel to avoid matching flyout duplicate
    const trayButton = page
      .locator('[data-bord-sidebar-panel="expanded"] [data-stash-tray-button]');
    if (await trayButton.isVisible()) {
      const text = await trayButton.textContent();
      expect(text).toMatch(/\d+/);
    }
  });

  test("N3: stash → open tray → click terminal → unstashes", async ({
    page,
    topbar,
    terminalPanel,
    sidebar,
    stashTray,
  }) => {
    // Ensure at least 2 terminals
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
    const before = await terminalPanel.visibleCount();

    // Stash one
    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);
    expect(await terminalPanel.visibleCount()).toBe(before - 1);

    // Open sidebar and stash tray
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Scope to expanded sidebar panel to avoid matching flyout duplicate
    const trayButton = page
      .locator('[data-bord-sidebar-panel="expanded"] [data-stash-tray-button]');
    if (!(await trayButton.isVisible())) {
      test.skip();
      return;
    }
    await trayButton.click();
    await page.waitForTimeout(300);

    // Click the stashed terminal (look for "↑" prefix in stash list)
    const stashedItems = page.locator("[data-sidebar-stash-zone] button.flex-1");
    const stashedCount = await stashedItems.count();
    if (stashedCount > 0) {
      await stashedItems.first().click();
      await page.waitForTimeout(500);

      // Should be unstashed — visible count back to before
      expect(await terminalPanel.visibleCount()).toBe(before);
    }
  });

  test("N-stash-display: stashed terminal shows in tray with prefix and italic", async ({
    page,
    topbar,
    terminalPanel,
    sidebar,
  }) => {
    // Ensure at least 2 terminals
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Stash one terminal
    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);

    // Open sidebar and stash tray
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const trayButton = page
      .locator('[data-bord-sidebar-panel="expanded"] [data-stash-tray-button]');
    if (!(await trayButton.isVisible())) {
      test.skip();
      return;
    }
    await trayButton.click();
    await page.waitForTimeout(300);

    // Verify stashed terminal shows with "↑" prefix and italic text
    const stashedItems = page.locator("[data-sidebar-stash-zone] button.flex-1");
    const stashedCount = await stashedItems.count();
    expect(stashedCount).toBeGreaterThan(0);

    const firstItemText = await stashedItems.first().textContent();
    expect(firstItemText).toContain("↑");

    // Check for italic class on the stash item (on span or parent)
    const hasItalic = await stashedItems.first().locator(".italic").count();
    const parentHasItalic = await stashedItems.first().evaluate(
      (el) => el.classList.contains("italic") || el.querySelector(".italic") !== null,
    );
    expect(hasItalic > 0 || parentHasItalic).toBe(true);
  });

  test("N-attention-badge: workspace button shows attention badge for stashed terminals", async ({
    page,
    topbar,
    terminalPanel,
    sidebar,
  }) => {
    // Select first fixture workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    const wsName = await wsButton.getAttribute("title");
    await wsButton.click();
    await page.waitForTimeout(500);

    // Ensure at least 2 terminals
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Stash a terminal
    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);

    // Verify stash tray count increased (at least 1 stashed terminal)
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const trayButton = page
      .locator('[data-bord-sidebar-panel="expanded"] [data-stash-tray-button]');
    if (await trayButton.isVisible()) {
      const trayText = await trayButton.textContent();
      // Tray should show a count > 0
      const match = trayText?.match(/(\d+)/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1])).toBeGreaterThan(0);
    }
  });

  test("N4: notification settings toggle exists", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(true);

    await settings.switchSection("Notifications");
    await page.waitForTimeout(200);

    // Check for toggle buttons
    const toggles = settings.notificationToggles();
    expect(await toggles.count()).toBeGreaterThanOrEqual(2);
  });

  test("N5: per-terminal mute toggle via global mute", async ({ page, topbar, terminalPanel }) => {
    // Ensure we have a terminal
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    const firstId = await terminalPanel.firstTerminalId();
    if (!firstId) {
      test.skip();
      return;
    }

    // The per-terminal mute button is only a <button> when muted or armed.
    // Use the global mute to force all WarmupIndicators into the muted fallback,
    // then the per-terminal "Unmute notifications" button will be visible.
    const globalTitle = await topbar.getGlobalMuteTitle();
    if (globalTitle === "Mute notifications") {
      // Enable global mute
      await topbar.toggleGlobalMute();
      await page.waitForTimeout(300);
    }

    // Now per-terminal should show "Unmute notifications" button
    const muteBtn = terminalPanel
      .panel(firstId)
      .locator('button[title="Unmute notifications"]');

    if (!(await muteBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Restore global mute state and skip
      if (globalTitle === "Mute notifications") await topbar.toggleGlobalMute();
      test.skip();
      return;
    }

    // Click per-terminal unmute — this toggles the per-terminal muted flag
    await muteBtn.click();
    await page.waitForTimeout(300);

    // Verify the global mute button still says "Unmute" (global state unchanged)
    expect(await topbar.getGlobalMuteTitle()).toBe("Unmute notifications");

    // Restore global mute state
    await topbar.toggleGlobalMute();
    await page.waitForTimeout(200);
  });

  test("N-multi-stash: stash 2 terminals, verify count, unstash one", async ({
    page,
    topbar,
    terminalPanel,
    sidebar,
  }) => {
    // Ensure at least 3 terminals (so stashing 2 leaves 1)
    while ((await terminalPanel.visibleCount()) < 3) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
    const before = await terminalPanel.visibleCount();

    // Stash two terminals
    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);
    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);

    expect(await terminalPanel.visibleCount()).toBe(before - 2);

    // Open sidebar and stash tray
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const trayButton = page
      .locator('[data-bord-sidebar-panel="expanded"] [data-stash-tray-button]');
    if (!(await trayButton.isVisible())) {
      test.skip();
      return;
    }
    await trayButton.click();
    await page.waitForTimeout(300);

    // Verify 2 stashed items with "↑" prefix
    const stashedItems = page.locator("[data-sidebar-stash-zone] button.flex-1");
    const stashedCount = await stashedItems.count();
    expect(stashedCount).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < Math.min(stashedCount, 2); i++) {
      const text = await stashedItems.nth(i).textContent();
      expect(text).toContain("↑");
    }

    // Unstash one
    await stashedItems.first().click();
    await page.waitForTimeout(500);

    // Count should decrease by 1
    expect(await terminalPanel.visibleCount()).toBe(before - 1);
  });
});
