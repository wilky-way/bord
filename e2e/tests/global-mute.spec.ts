import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Global mute", () => {
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

  test("GM-1: global mute button visible in topbar", async ({ page }) => {
    const muteBtn = page.locator(sel.globalMuteButton).first();
    await expect(muteBtn).toBeVisible();
  });

  test("GM-2: click toggles title between Mute and Unmute", async ({ page, topbar }) => {
    const titleBefore = await topbar.getGlobalMuteTitle();

    await topbar.toggleGlobalMute();
    await page.waitForTimeout(300);

    const titleAfter = await topbar.getGlobalMuteTitle();

    // Title should flip between "Mute notifications" and "Unmute notifications"
    expect(titleAfter).not.toBe(titleBefore);
    expect([titleBefore, titleAfter].sort()).toEqual(
      ["Mute notifications", "Unmute notifications"].sort(),
    );

    // Toggle back to original state
    await topbar.toggleGlobalMute();
    await page.waitForTimeout(200);
    expect(await topbar.getGlobalMuteTitle()).toBe(titleBefore);
  });

  test("GM-3: mute persists across settings open/close", async ({ page, topbar, settings }) => {
    // Get initial state
    const initialTitle = await topbar.getGlobalMuteTitle();

    // Toggle mute
    await topbar.toggleGlobalMute();
    await page.waitForTimeout(200);
    const mutedTitle = await topbar.getGlobalMuteTitle();
    expect(mutedTitle).not.toBe(initialTitle);

    // Open and close settings
    await settings.open();
    expect(await settings.isOpen()).toBe(true);

    await settings.close();
    await page.waitForTimeout(300);

    // Mute state should persist
    expect(await topbar.getGlobalMuteTitle()).toBe(mutedTitle);

    // Restore original state
    await topbar.toggleGlobalMute();
  });

  test("GM-4: global mute shows per-terminal muted indicator", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }

    // Get initial global mute title
    const initialTitle = await topbar.getGlobalMuteTitle();

    // If currently muted, unmute first to ensure clean state
    if (initialTitle === "Unmute notifications") {
      await topbar.toggleGlobalMute();
      await page.waitForTimeout(200);
    }

    // Mute globally
    await topbar.toggleGlobalMute();
    await page.waitForTimeout(300);

    // The global mute button should now say "Unmute"
    expect(await topbar.getGlobalMuteTitle()).toBe("Unmute notifications");

    // When globally muted, the WarmupIndicator renders an "Unmute notifications" button
    // on each terminal panel (the fallback path of effectivelyMuted())
    const firstId = await terminalPanel.firstTerminalId();
    if (firstId) {
      const termUnmuteBtn = terminalPanel.panel(firstId).locator(
        'button[title="Unmute notifications"]',
      );
      await expect(termUnmuteBtn).toBeVisible({ timeout: 3000 });
    }

    // Restore original state
    await topbar.toggleGlobalMute();
  });
});
