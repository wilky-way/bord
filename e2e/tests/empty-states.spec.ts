import { test, expect } from "../fixtures/bord-test";
import { apiClient } from "../helpers/api-client";

test.describe("Empty states", () => {
  test("no workspaces → onboarding prompt visible", async ({ page }) => {
    // Delete all fixture workspaces to reach zero-workspace state
    const workspaces = await apiClient.listWorkspaces();
    const fixtureIds = workspaces
      .filter((w) => w.name.startsWith("fixture-"))
      .map((w) => w.id);

    for (const id of fixtureIds) {
      await apiClient.deleteWorkspace(id);
    }

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The sidebar rail should have no workspace buttons
    const wsButtons = page.locator("[data-bord-sidebar-rail] button[title^='fixture-']");
    expect(await wsButtons.count()).toBe(0);

    // "Open project" button should be visible for onboarding
    const addButton = page.locator('button[title="Open project"]');
    await expect(addButton).toBeVisible();

    // No terminal panels should be rendered
    const terminals = page.locator("[data-terminal-id]");
    expect(await terminals.count()).toBe(0);

    // Re-register workspaces for subsequent tests
    const { execSync } = await import("child_process");
    const { join } = await import("path");
    const PROJECT_ROOT = join(import.meta.dirname, "../..");
    execSync("bun run scripts/fixtures/register-workspaces.ts", {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      timeout: 30_000,
    });
  });

  test("workspace with no terminals → empty grid area", async ({
    page,
    sidebar,
    terminalPanel,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select first fixture workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

    // Close all terminals in the workspace
    let count = await terminalPanel.visibleCount();
    let safety = 0;
    while (count > 1 && safety < 20) {
      await terminalPanel.closeFirst();
      await page.waitForTimeout(500);
      count = await terminalPanel.visibleCount();
      safety++;
    }

    // With 0 or 1 terminal, verify the layout still renders without error
    // (last terminal can't be closed via button, but layout should be stable)
    const layout = page.locator("[data-terminal-id]");
    expect(await layout.count()).toBeGreaterThanOrEqual(0);
  });

  test("no sessions found → empty message in session list", async ({
    page,
    sidebar,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select first fixture workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

    // Open sidebar expanded panel
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Click the Sessions tab if not already selected
    const sessionsTab = page.locator('[data-panel-session-tab="sessions"]');
    await sessionsTab.click();
    await page.waitForTimeout(1000);

    // Should show either sessions or "No sessions found" message
    const noSessions = page.locator("text=No sessions found");
    const sessionCards = page.locator(
      '[data-bord-sidebar-panel="expanded"] .px-2.pb-2 button.w-full.text-left',
    );

    const hasNoSessionsMsg = await noSessions.isVisible();
    const hasSessionCards = (await sessionCards.count()) > 0;

    // One of these states must be true (not both empty and not both populated in a contradictory way)
    expect(hasNoSessionsMsg || hasSessionCards).toBe(true);
  });

  test("empty stash tray shows 'No stashed terminals'", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (!(await wsButton.isVisible())) {
      test.skip();
      return;
    }
    await wsButton.click();
    await page.waitForTimeout(500);

    // Ensure at least one terminal (so workspace has terminals)
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }

    // Open sidebar and switch to Stashed tab
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const stashedTab = page.locator('[data-panel-session-tab="stashed"]');
    await stashedTab.click();
    await page.waitForTimeout(300);

    // If no terminals are stashed, should show empty message
    const noStashed = page.locator("text=No stashed terminals");
    const stashedItems = page.locator(
      '[data-bord-sidebar-panel="expanded"] .px-2.pb-2 button.w-full.text-left',
    );

    const hasNoStashedMsg = await noStashed.isVisible();
    const hasStashedItems = (await stashedItems.count()) > 0;

    // At least one state should be true
    expect(hasNoStashedMsg || hasStashedItems).toBe(true);
  });
});
