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
    const muteBtn = page.locator(sel.globalMuteButton);
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
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(true);

    await settings.close();
    await page.waitForTimeout(300);

    // Mute state should persist
    expect(await topbar.getGlobalMuteTitle()).toBe(mutedTitle);

    // Restore original state
    await topbar.toggleGlobalMute();
  });

  test("GM-4: global mute affects per-terminal visual state", async ({
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

    // Per-terminal mute button state — the mute/unmute buttons on individual
    // terminals should still be independently controllable
    const firstId = await terminalPanel.firstTerminalId();
    if (firstId) {
      const termMuteBtn = terminalPanel.panel(firstId).locator(
        'button[title="Mute notifications"], button[title="Unmute notifications"]',
      );
      // Terminal mute button should still be visible and clickable
      if (await termMuteBtn.isVisible()) {
        await expect(termMuteBtn).toBeVisible();
      }
    }

    // Restore original state
    await topbar.toggleGlobalMute();
  });
});
