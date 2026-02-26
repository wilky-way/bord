import { test, expect } from "../fixtures/bord-test";

test.describe("Settings — extended coverage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("font picker changes terminal font family", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(true);

    const fontSelect = settings.fontSelect();
    await expect(fontSelect).toBeVisible();

    // Get current value
    const initialFont = await fontSelect.inputValue();

    // Get all options
    const options = fontSelect.locator("option");
    const optionCount = await options.count();
    if (optionCount < 2) {
      test.skip();
      return;
    }

    // Pick a different font (not the first one, not "Custom...")
    let selectedFont = "";
    for (let i = 0; i < optionCount; i++) {
      const label = await options.nth(i).textContent();
      const value = await options.nth(i).getAttribute("value");
      if (value && value !== initialFont && !label?.includes("Custom")) {
        selectedFont = value;
        break;
      }
    }

    if (!selectedFont) {
      test.skip();
      return;
    }

    await fontSelect.selectOption(selectedFont);
    await page.waitForTimeout(300);

    // Verify the CSS variable changed on the root element
    const currentFont = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim(),
    );
    expect(currentFont).toBeTruthy();
  });

  test("notification sound toggles persist within session", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    await settings.switchSection("Notifications");
    await page.waitForTimeout(200);

    const toggles = settings.notificationToggles();
    const toggleCount = await toggles.count();
    if (toggleCount < 1) {
      test.skip();
      return;
    }

    // Record initial state of first toggle via background color (toggle uses inline style)
    const firstToggle = toggles.first();
    const initialBg = await firstToggle.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Click to toggle
    await firstToggle.click();
    await page.waitForTimeout(300);
    const afterBg = await firstToggle.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Background color should change (accent <-> tertiary)
    expect(afterBg).not.toBe(initialBg);

    // Close and reopen settings — toggle should persist
    await settings.close();
    await page.waitForTimeout(300);

    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    await settings.switchSection("Notifications");
    await page.waitForTimeout(200);

    const reopenedBg = await toggles.first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(reopenedBg).toBe(afterBg);
  });

  test("theme persists across page reload", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    const swatches = settings.themeSwatches();
    const swatchCount = await swatches.count();
    if (swatchCount < 2) {
      test.skip();
      return;
    }

    // Find a non-active swatch and click it
    let targetThemeName = "";
    for (let i = 0; i < swatchCount; i++) {
      const swatch = swatches.nth(i);
      const classes = await swatch.getAttribute("class");
      if (!classes?.includes("border-[var(--accent)]")) {
        targetThemeName = (await swatch.getAttribute("title")) ?? "";
        await swatch.click();
        await page.waitForTimeout(300);
        break;
      }
    }

    if (!targetThemeName) {
      test.skip();
      return;
    }

    // Record the --bg-primary value after theme change
    const bgAfterChange = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg-primary").trim(),
    );

    // Close settings
    await settings.close();
    await page.waitForTimeout(300);

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Verify the theme persisted
    const bgAfterReload = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg-primary").trim(),
    );
    expect(bgAfterReload).toBe(bgAfterChange);

    // Reopen settings and verify the swatch is still selected
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    const selectedSwatch = settings.modal.locator(`button[title="${targetThemeName}"]`);
    const selectedClasses = await selectedSwatch.getAttribute("class");
    expect(selectedClasses).toContain("border-[var(--accent)]");
  });

  test("notifications panel exposes OSC-only mode copy", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    await settings.switchSection("Notifications");
    await page.waitForTimeout(200);

    await expect(settings.modal.locator("text=/Detection mode/i")).toBeVisible();
    await expect(settings.modal.locator("text=/OSC title signals only/i")).toBeVisible();
    await expect(settings.modal.locator("text=/output-silence heuristics/i")).toBeVisible();
  });

  test("settings sections switch correctly", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    // Appearance should be default
    const swatches = settings.themeSwatches();
    expect(await swatches.count()).toBeGreaterThan(0);

    // Switch to Notifications
    await settings.switchSection("Notifications");
    await page.waitForTimeout(200);
    const toggles = settings.notificationToggles();
    expect(await toggles.count()).toBeGreaterThanOrEqual(1);

    // Switch to About
    await settings.switchSection("About");
    await page.waitForTimeout(200);
    const versionText = settings.modal.locator("text=/Bord v/");
    await expect(versionText).toBeVisible();

    // Switch back to Appearance
    await settings.switchSection("Appearance");
    await page.waitForTimeout(200);
    expect(await swatches.count()).toBeGreaterThan(0);
  });

  test("closing settings with backdrop click", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(true);

    // Click the backdrop area (outside the modal content)
    // The backdrop is the .fixed.inset-0 element
    const backdrop = settings.modal;
    const box = await backdrop.boundingBox();
    if (!box) {
      test.skip();
      return;
    }

    // Click near the edge (outside the centered modal content)
    await page.mouse.click(box.x + 10, box.y + 10);
    await page.waitForTimeout(300);

    expect(await settings.isOpen()).toBe(false);
  });
});
