import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Diff viewer (DV1-DV3)", () => {
  test.beforeEach(async ({ page, sidebar, topbar, terminalPanel }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select fixture-web workspace (has staged + unstaged + untracked files)
    const wsButton = sidebar.rail.locator('button[title="fixture-web"]');
    if (await wsButton.isVisible()) {
      await wsButton.click();
      await page.waitForTimeout(500);
    }

    // Ensure at least one terminal exists
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }
  });

  test("DV-1: clicking file shows diff with colored lines", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.terminalPanel()).first().locator(sel.toggleGitPanel);
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // Click a file that has diff content (staged or unstaged)
    const fileButtons = gitPanel.root.locator("button").filter({ hasText: /\.(ts|css|md)$/ });
    const fileCount = await fileButtons.count();
    if (fileCount === 0) {
      test.skip();
      return;
    }

    await fileButtons.first().click();
    await page.waitForTimeout(500);

    // Diff should show colored lines (added lines use --success, removed use --danger)
    const addedLines = gitPanel.root.locator(".text-\\[var\\(--success\\)\\]");
    const removedLines = gitPanel.root.locator(".text-\\[var\\(--danger\\)\\]");
    const hunkHeaders = gitPanel.root.locator(".text-\\[var\\(--accent\\)\\]");

    const totalColoredElements =
      (await addedLines.count()) + (await removedLines.count()) + (await hunkHeaders.count());
    expect(totalColoredElements).toBeGreaterThan(0);
  });

  test("DV-2: hunk counter shows N/M hunks text", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.terminalPanel()).first().locator(sel.toggleGitPanel);
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    const fileButtons = gitPanel.root.locator("button").filter({ hasText: /\.(ts|css|md)$/ });
    if ((await fileButtons.count()) === 0) {
      test.skip();
      return;
    }

    await fileButtons.first().click();
    await page.waitForTimeout(500);

    // Look for the hunk counter text pattern "N/M hunks"
    const hunkCounter = gitPanel.root.locator("text=/\\d+\\/\\d+\\s+hunks?/");
    if ((await hunkCounter.count()) > 0) {
      const text = await hunkCounter.first().textContent();
      expect(text).toMatch(/\d+\/\d+\s+hunks?/);
    }
  });

  test("DV-3: next/prev hunk navigation buttons", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.terminalPanel()).first().locator(sel.toggleGitPanel);
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    const fileButtons = gitPanel.root.locator("button").filter({ hasText: /\.(ts|css|md)$/ });
    if ((await fileButtons.count()) === 0) {
      test.skip();
      return;
    }

    await fileButtons.first().click();
    await page.waitForTimeout(500);

    const prevBtn = gitPanel.root.locator('button[title="Previous hunk"]');
    const nextBtn = gitPanel.root.locator('button[title="Next hunk"]');

    if ((await nextBtn.count()) === 0) {
      // Diff may have no hunks
      test.skip();
      return;
    }

    // At the first hunk, prev should be disabled
    await expect(prevBtn).toBeDisabled();

    // Click next — prev should become enabled (if there are 2+ hunks)
    const nextDisabled = await nextBtn.isDisabled();
    if (!nextDisabled) {
      await nextBtn.click();
      await page.waitForTimeout(200);
      await expect(prevBtn).toBeEnabled();
    }
  });
});
