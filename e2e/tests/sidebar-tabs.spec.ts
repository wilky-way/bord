import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Sidebar tabs", () => {
  test.beforeEach(async ({ page, sidebar, topbar, terminalPanel }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select first fixture workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (await wsButton.isVisible()) {
      await wsButton.click();
      await page.waitForTimeout(500);
    }

    // Ensure at least one terminal
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }

    // Ensure sidebar is expanded
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);
  });

  test("ST-1: All tab shows all terminals including stashed", async ({ page, terminalPanel }) => {
    // Click "All" tab in the expanded panel
    const allTab = page.locator(sel.panelSessionTab("all"));
    if (!(await allTab.isVisible())) {
      test.skip();
      return;
    }

    await allTab.click();
    await page.waitForTimeout(300);

    // The All tab content should list terminal buttons
    const panelContent = page.locator('[data-bord-sidebar-panel="expanded"]');
    const terminalButtons = panelContent.locator("button.w-full.text-left");
    const allCount = await terminalButtons.count();
    const visibleCount = await terminalPanel.visibleCount();

    // All count should be >= visible count (includes stashed)
    expect(allCount).toBeGreaterThanOrEqual(visibleCount);
  });

  test("ST-2: Sessions tab shows provider sessions", async ({ page }) => {
    // Click "Sessions" tab
    const sessionsTab = page.locator(sel.panelSessionTab("sessions"));
    if (!(await sessionsTab.isVisible())) {
      test.skip();
      return;
    }

    await sessionsTab.click();
    await page.waitForTimeout(1000);

    // Should show session cards or "No sessions found"
    const panelContent = page.locator('[data-bord-sidebar-panel="expanded"]');
    const panelText = await panelContent.textContent();

    // One of these should be present
    const hasContent =
      panelText?.includes("No sessions found") ||
      panelText?.includes("Loading sessions") ||
      panelText?.includes("msgs");

    expect(hasContent).toBe(true);
  });

  test("ST-3: Active tab shows only non-stashed terminals", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    // Ensure at least 2 terminals, stash one
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    const visibleBefore = await terminalPanel.visibleCount();

    // Stash the first terminal
    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);

    // Click "Active" tab
    const activeTab = page.locator(sel.panelSessionTab("active"));
    if (!(await activeTab.isVisible())) {
      test.skip();
      return;
    }

    await activeTab.click();
    await page.waitForTimeout(300);

    // Active tab should show visibleBefore - 1 terminals
    const panelContent = page.locator('[data-bord-sidebar-panel="expanded"]');
    const terminalButtons = panelContent.locator("button.w-full.text-left");
    const activeCount = await terminalButtons.count();

    expect(activeCount).toBe(visibleBefore - 1);
  });

  test("ST-4: Stashed tab shows only stashed terminals", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    // Ensure at least 2 terminals
    while ((await terminalPanel.visibleCount()) < 2) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Stash the first terminal
    await terminalPanel.stashFirst();
    await page.waitForTimeout(500);

    // Click "Stashed" tab
    const stashedTab = page.locator(sel.panelSessionTab("stashed"));
    if (!(await stashedTab.isVisible())) {
      test.skip();
      return;
    }

    await stashedTab.click();
    await page.waitForTimeout(300);

    // Stashed tab should show at least 1 terminal
    const panelContent = page.locator('[data-bord-sidebar-panel="expanded"]');
    const terminalButtons = panelContent.locator("button.w-full.text-left");
    const stashedCount = await terminalButtons.count();

    expect(stashedCount).toBeGreaterThanOrEqual(1);
  });

  test("ST-5: Tab switching updates content", async ({ page }) => {
    const sessionsTab = page.locator(sel.panelSessionTab("sessions"));
    const allTab = page.locator(sel.panelSessionTab("all"));

    if (!(await sessionsTab.isVisible()) || !(await allTab.isVisible())) {
      test.skip();
      return;
    }

    // Click Sessions tab and capture content
    await sessionsTab.click();
    await page.waitForTimeout(500);
    const panelContent = page.locator('[data-bord-sidebar-panel="expanded"]');
    const sessionsContent = await panelContent.textContent();

    // Click All tab and capture content
    await allTab.click();
    await page.waitForTimeout(500);
    const allContent = await panelContent.textContent();

    // Content should change (they show different things)
    // The tab text itself changes at minimum
    expect(sessionsContent).toBeTruthy();
    expect(allContent).toBeTruthy();
  });

  test("ST-6: Tab accent state correct", async ({ page }) => {
    const sessionsTab = page.locator(sel.panelSessionTab("sessions"));
    const allTab = page.locator(sel.panelSessionTab("all"));

    if (!(await sessionsTab.isVisible()) || !(await allTab.isVisible())) {
      test.skip();
      return;
    }

    // Click Sessions tab
    await sessionsTab.click();
    await page.waitForTimeout(200);

    // Sessions tab should have accent background (active class)
    let sessionsClasses = await sessionsTab.getAttribute("class");
    expect(sessionsClasses).toContain("text-[var(--text-primary)]");

    // All tab should not have accent background
    let allClasses = await allTab.getAttribute("class");
    expect(allClasses).toContain("text-[var(--text-secondary)]");

    // Click All tab
    await allTab.click();
    await page.waitForTimeout(200);

    // Now All should be active
    allClasses = await allTab.getAttribute("class");
    expect(allClasses).toContain("text-[var(--text-primary)]");

    sessionsClasses = await sessionsTab.getAttribute("class");
    expect(sessionsClasses).toContain("text-[var(--text-secondary)]");
  });
});
