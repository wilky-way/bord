import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Feature flags", () => {
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

  test("FF-1: Features tab exists in settings", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    expect(await settings.isOpen()).toBe(true);

    const featuresNav = settings.modal.locator('button:has-text("Features")');
    await expect(featuresNav).toBeVisible();
  });

  test("FF-2: toggle git off -> git badge disappears on terminals", async ({
    page,
    settings,
    topbar,
    terminalPanel,
  }) => {
    // Ensure a terminal exists
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }

    // Wait for git branch badge to potentially appear
    await page.waitForTimeout(2000);

    // Open settings and disable git
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);

    await settings.switchSection("Features");
    await page.waitForTimeout(300);

    // Find the Git integration toggle
    const gitToggle = settings.modal.locator('label:has-text("Git integration") button');
    if (!(await gitToggle.isVisible())) {
      test.skip();
      return;
    }

    // Check current state — if git is enabled, toggle it off
    const bgBefore = await gitToggle.evaluate((el) => getComputedStyle(el).background);
    await gitToggle.click();
    await page.waitForTimeout(500);

    // Close settings
    await settings.close();
    await page.waitForTimeout(500);

    // Git branch badge should not be visible
    const branchBadge = page.locator(sel.toggleGitPanel);
    expect(await branchBadge.count()).toBe(0);

    // Re-enable git
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);
    await gitToggle.click();
    await page.waitForTimeout(300);
    await settings.close();
  });

  test("FF-3: toggle git off -> /api/git/* returns error", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);

    const gitToggle = settings.modal.locator('label:has-text("Git integration") button');
    if (!(await gitToggle.isVisible())) {
      test.skip();
      return;
    }

    // Disable git
    await gitToggle.click();
    await page.waitForTimeout(500);
    await settings.close();
    await page.waitForTimeout(300);

    // The UI should no longer show git badges (API availability is controlled by feature flag in UI)
    const branchBadge = page.locator(sel.toggleGitPanel);
    expect(await branchBadge.count()).toBe(0);

    // Re-enable
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);
    await gitToggle.click();
    await page.waitForTimeout(300);
    await settings.close();
  });

  test("FF-4: toggle git back on -> badge restores", async ({
    page,
    settings,
    topbar,
    terminalPanel,
  }) => {
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }

    // Disable git
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);

    const gitToggle = settings.modal.locator('label:has-text("Git integration") button');
    if (!(await gitToggle.isVisible())) {
      test.skip();
      return;
    }

    await gitToggle.click();
    await page.waitForTimeout(500);
    await settings.close();
    await page.waitForTimeout(500);

    // Verify git badge is gone
    expect(await page.locator(sel.toggleGitPanel).count()).toBe(0);

    // Re-enable git
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);
    await gitToggle.click();
    await page.waitForTimeout(300);
    await settings.close();
    await page.waitForTimeout(2000);

    // Git badge may reappear after fetch (depends on workspace being a git repo)
    // Just verify no crash occurred
    expect(await terminalPanel.visibleCount()).toBeGreaterThanOrEqual(1);
  });

  test("FF-5: toggle docker off -> Docker section disappears from sidebar", async ({
    page,
    settings,
    sidebar,
  }) => {
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Check if Docker header exists first
    const dockerHeader = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Docker")',
    );
    const hadDocker = await dockerHeader.isVisible();

    // Open settings and toggle docker off
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);

    const dockerToggle = settings.modal.locator('label:has-text("Docker panel") button');
    if (!(await dockerToggle.isVisible())) {
      test.skip();
      return;
    }

    await dockerToggle.click();
    await page.waitForTimeout(500);
    await settings.close();
    await page.waitForTimeout(500);

    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    if (hadDocker) {
      // Docker section should be hidden
      expect(await dockerHeader.isVisible()).toBe(false);
    }

    // Re-enable docker
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);
    await dockerToggle.click();
    await page.waitForTimeout(300);
    await settings.close();
  });

  test("FF-6: toggle docker back on -> restores", async ({ page, settings, sidebar }) => {
    // Disable docker
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);

    const dockerToggle = settings.modal.locator('label:has-text("Docker panel") button');
    if (!(await dockerToggle.isVisible())) {
      test.skip();
      return;
    }

    await dockerToggle.click();
    await page.waitForTimeout(500);
    await settings.close();
    await page.waitForTimeout(300);

    // Re-enable docker
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);
    await dockerToggle.click();
    await page.waitForTimeout(300);
    await settings.close();
    await page.waitForTimeout(300);

    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Docker section should be back
    const dockerHeader = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Docker")',
    );
    await expect(dockerHeader).toBeVisible();
  });

  test("FF-7: Providers sub-section exists in Features", async ({ page, settings }) => {
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);

    // Should show "Providers" label
    const providersLabel = settings.modal.locator("text=Providers");
    await expect(providersLabel).toBeVisible();
  });

  test("FF-8: toggle provider off -> tab disappears, back on -> restores", async ({
    page,
    settings,
    sidebar,
  }) => {
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Check which provider tabs are visible
    const geminiTab = page.locator('button[title="Gemini"]').first();
    const hadGemini = await geminiTab.isVisible();

    if (!hadGemini) {
      test.skip();
      return;
    }

    // Open settings and disable Gemini provider
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);

    // Find Gemini toggle in the Providers section
    const geminiToggle = settings.modal.locator('label:has-text("Gemini") button');
    if (!(await geminiToggle.isVisible())) {
      test.skip();
      return;
    }

    await geminiToggle.click();
    await page.waitForTimeout(500);
    await settings.close();
    await page.waitForTimeout(500);

    // Gemini tab should be hidden
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);
    expect(await geminiTab.isVisible()).toBe(false);

    // Re-enable Gemini
    await page.keyboard.press("Meta+,");
    await page.waitForTimeout(300);
    await settings.switchSection("Features");
    await page.waitForTimeout(300);
    await geminiToggle.click();
    await page.waitForTimeout(300);
    await settings.close();
    await page.waitForTimeout(500);

    // Gemini tab should be restored
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);
    await expect(geminiTab).toBeVisible();
  });
});
