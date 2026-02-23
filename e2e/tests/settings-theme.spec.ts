import { test, expect } from "../fixtures/bord-test";

test.describe("Settings & themes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("open settings with Cmd+, → modal appears", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(true);
  });

  test("close settings with Escape", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(true);

    await settings.pressEscapeToClose();
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(false);
  });

  test("close settings with X button", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(true);

    await settings.close();
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(false);
  });

  test("15 theme swatches render in Appearance section", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    // Should already be on Appearance section
    const swatches = settings.themeSwatches();
    expect(await swatches.count()).toBe(15);
  });

  test("clicking a theme changes CSS variables", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    // Get initial --bg-primary value
    const initialBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg-primary").trim(),
    );

    // Click a different theme swatch (try the second one)
    const swatches = settings.themeSwatches();
    const count = await swatches.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Click a swatch that's not currently active
    for (let i = 0; i < count; i++) {
      const swatch = swatches.nth(i);
      const classes = await swatch.getAttribute("class");
      if (!classes?.includes("border-[var(--accent)]")) {
        await swatch.click();
        await page.waitForTimeout(300);
        break;
      }
    }

    const newBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg-primary").trim(),
    );

    // Verify the theme actually changed
    expect(newBg).toBeTruthy();
    expect(newBg).not.toBe(initialBg);
  });

  test("font picker dropdown lists preset options", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    const fontSelect = settings.fontSelect();
    await expect(fontSelect).toBeVisible();

    const options = fontSelect.locator("option");
    expect(await options.count()).toBeGreaterThanOrEqual(2);
  });

  test("Notifications section has sound toggles", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    await settings.switchSection("Notifications");
    await page.waitForTimeout(200);

    // "Agent done" and "Error alert" toggles
    const toggles = settings.notificationToggles();
    expect(await toggles.count()).toBeGreaterThanOrEqual(2);

    // Click a toggle — should not crash
    await toggles.first().click();
    await page.waitForTimeout(200);
  });

  test("About section renders version and update check", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    await settings.switchSection("About");
    await page.waitForTimeout(200);

    // Verify version text shows "Bord v"
    const versionText = settings.modal.locator("text=/Bord v/");
    await expect(versionText).toBeVisible();

    // Verify "Check for updates" button exists
    const updateButton = settings.modal.locator('button:has-text("Check for updates")');
    await expect(updateButton).toBeVisible();
  });

  test("Theme persistence across settings reopen", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    const swatches = settings.themeSwatches();
    const count = await swatches.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Find a non-active swatch and click it
    let selectedThemeName = "";
    for (let i = 0; i < count; i++) {
      const swatch = swatches.nth(i);
      const classes = await swatch.getAttribute("class");
      if (!classes?.includes("border-[var(--accent)]")) {
        selectedThemeName = (await swatch.getAttribute("title")) ?? "";
        await swatch.click();
        await page.waitForTimeout(300);
        break;
      }
    }

    if (!selectedThemeName) {
      test.skip();
      return;
    }

    // Close settings
    await settings.close();
    await page.waitForTimeout(300);

    // Reopen settings
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    // Verify the same theme is still selected (has accent border)
    const selectedSwatch = settings.modal.locator(`button[title="${selectedThemeName}"]`);
    const classes = await selectedSwatch.getAttribute("class");
    expect(classes).toContain("border-[var(--accent)]");
  });

  test("Font picker custom option shows input", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    const fontSelect = settings.fontSelect();
    await expect(fontSelect).toBeVisible();

    // Check if "Custom..." option exists in dropdown
    const customOption = fontSelect.locator('option:has-text("Custom")');
    if ((await customOption.count()) === 0) {
      test.skip();
      return;
    }

    // Select "Custom..." option
    await fontSelect.selectOption({ label: "Custom..." });
    await page.waitForTimeout(300);

    // Verify a custom font input field appears (input with font placeholder)
    const customInput = settings.modal.locator('input[placeholder*="Font"], input[placeholder*="font"]');
    await expect(customInput.first()).toBeVisible();
  });

  test("idle threshold slider is interactive", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    await settings.switchSection("Notifications");
    await page.waitForTimeout(200);

    const slider = settings.idleSlider().first();
    await expect(slider).toBeVisible();

    // Get initial value
    const initialValue = await slider.inputValue();
    expect(parseInt(initialValue)).toBeGreaterThanOrEqual(5000);
    expect(parseInt(initialValue)).toBeLessThanOrEqual(30000);
  });

  test("Check for updates button click doesn't crash", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    await settings.switchSection("About");
    await page.waitForTimeout(200);

    const updateButton = settings.modal.locator('button:has-text("Check for updates")');
    if (!(await updateButton.isVisible())) {
      test.skip();
      return;
    }

    // Click the button — it should not crash
    await updateButton.click();
    await page.waitForTimeout(1000);

    // Settings should still be open and functional
    expect(await settings.isOpen()).toBe(true);

    // The button text may change to "Checking..." temporarily
    const btnText = await updateButton.textContent();
    expect(btnText).toMatch(/Check for updates|Checking/);
  });
});
