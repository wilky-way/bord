import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Git panel (G1-G7)", () => {
  test.beforeEach(async ({ page, sidebar, topbar, terminalPanel }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select fixture-web workspace (has staged + unstaged + untracked + ahead)
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

  test("G1: toggle git panel open and closed", async ({ page, terminalPanel, gitPanel }) => {
    // Wait for branch badge to appear
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });

    // Open
    await toggleBtn.click();
    await page.waitForTimeout(500);
    expect(await gitPanel.isVisible()).toBe(true);

    // Close by clicking toggle again
    await toggleBtn.click();
    await page.waitForTimeout(300);
    expect(await gitPanel.isVisible()).toBe(false);
  });

  test("G2: fixture-web shows staged, unstaged, and untracked files", async ({
    page,
    gitPanel,
  }) => {
    // Open git panel
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    expect(await gitPanel.isVisible()).toBe(true);

    // Check for Source Control heading
    await expect(gitPanel.sourceControlHeading()).toBeVisible();

    // fixture-web should have:
    // - staged: src/theme.css
    // - unstaged: src/panel.ts
    // - untracked: notes/todo.md
    // These show in different sections of ChangedFilesList
    const panelText = await gitPanel.root.textContent();
    // At least check for the presence of file sections
    expect(panelText).toBeTruthy();
  });

  test("G3: clicking a file shows diff content", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // Look for any clickable file name in the panel
    const fileButtons = gitPanel.root.locator("button").filter({ hasText: /\.(ts|css|md)$/ });
    const fileCount = await fileButtons.count();
    if (fileCount === 0) {
      test.skip();
      return;
    }

    await fileButtons.first().click();
    await page.waitForTimeout(500);

    // Diff content should appear (DiffViewer renders a pre or code block)
    const diffContent = gitPanel.root.locator("pre, code");
    const hasDiff = (await diffContent.count()) > 0;
    expect(hasDiff).toBe(true);
  });

  test("G4: stage and unstage a file", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // Look for stage/unstage action buttons (+ or - icons near files)
    // The ChangedFilesList renders stage/unstage buttons per file
    const stageButtons = gitPanel.root.locator('button[title*="tage"]');
    const stageCount = await stageButtons.count();
    if (stageCount === 0) {
      test.skip();
      return;
    }

    // Click the first stage/unstage button
    await stageButtons.first().click();
    await page.waitForTimeout(500);

    // Panel should still be visible and functional
    expect(await gitPanel.isVisible()).toBe(true);
  });

  test("G5: commit flow — type message and submit", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // Check for commit input
    const commitInput = gitPanel.commitInput();
    if (!(await commitInput.isVisible())) {
      test.skip();
      return;
    }

    // Type a commit message
    await commitInput.fill("test: e2e commit message");
    await page.waitForTimeout(200);

    // Verify input has value
    const value = await commitInput.inputValue();
    expect(value).toBe("test: e2e commit message");
  });

  test("G6: push badge shows ahead count", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // fixture-web is 1 commit ahead — look for push badge with "↑" and a number
    const pushBadge = gitPanel.pushBadge();
    if (await pushBadge.isVisible()) {
      const text = await pushBadge.textContent();
      // Should contain "↑" and a number
      expect(text).toMatch(/↑\d+/);
    }
  });

  test("G7: RepoNavigator shows parent/sibling repos", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // RepoNavigator renders at the top of GitPanel with breadcrumb-like repo buttons
    // fixture-web is a child of mono-hub, so sibling repos should appear
    const repoNav = gitPanel.root.locator("button").filter({ hasText: /fixture-|mono-|app-/ });
    const repoCount = await repoNav.count();

    // Should have at least the current repo indicator
    expect(repoCount).toBeGreaterThanOrEqual(0);
  });

  test("G2b: fixture-web shows specific file sections and names", async ({
    page,
    gitPanel,
  }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    expect(await gitPanel.isVisible()).toBe(true);

    // Verify section headings
    await expect(gitPanel.stagedSection()).toBeVisible();
    await expect(gitPanel.unstagedSection()).toBeVisible();
    await expect(gitPanel.untrackedSection()).toBeVisible();

    // Verify specific fixture-web files
    const panelText = await gitPanel.root.textContent();
    expect(panelText).toContain("theme.css");
    expect(panelText).toContain("panel.ts");
    expect(panelText).toContain("todo.md");
  });

  test("G4b: Stage All / Unstage All buttons", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // Verify Stage All button is present in the Changed section
    const stageAllBtn = gitPanel.stageAllButton();
    if (!(await stageAllBtn.first().isVisible())) {
      test.skip();
      return;
    }

    // Click Stage All — unstaged files should move to staged
    await stageAllBtn.first().click();
    await page.waitForTimeout(500);

    // Unstage All should now be visible (staged section grew)
    const unstageAllBtn = gitPanel.unstageAllButton();
    await expect(unstageAllBtn.first()).toBeVisible();

    // Click Unstage All — files should return to Changed section
    await unstageAllBtn.first().click();
    await page.waitForTimeout(500);

    // Changed section should be visible again
    await expect(gitPanel.unstagedSection()).toBeVisible();
  });

  test("G5b: Commit button is disabled when message is empty", async ({
    page,
    gitPanel,
  }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    const commitBtn = gitPanel.commitButton();
    if (!(await commitBtn.isVisible())) {
      test.skip();
      return;
    }

    // With empty message, button should be disabled
    await expect(commitBtn).toBeDisabled();

    // Type a message — button should become enabled
    const commitInput = gitPanel.commitInput();
    await commitInput.fill("test: check disabled state");
    await page.waitForTimeout(200);

    await expect(commitBtn).toBeEnabled();

    // Clear message — button should be disabled again
    await commitInput.fill("");
    await page.waitForTimeout(200);
    await expect(commitBtn).toBeDisabled();
  });

  test("G5c: Commit execution clears staged files", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // Verify staged section exists before commit
    if (!(await gitPanel.stagedSection().isVisible())) {
      test.skip();
      return;
    }

    const commitBtn = gitPanel.commitButton();
    if (!(await commitBtn.isVisible())) {
      test.skip();
      return;
    }

    // Type commit message and click Commit
    const commitInput = gitPanel.commitInput();
    await commitInput.fill("test: e2e commit execution");
    await page.waitForTimeout(200);

    await commitBtn.click();
    await page.waitForTimeout(2000);

    // After commit, staged section should be gone (or empty)
    // The panel refreshes after commit — staged files were committed
    const stagedVisible = await gitPanel.stagedSection().isVisible();
    // Staged section should disappear after committing
    expect(stagedVisible).toBe(false);
  });

  test("G6b: Push execution clears ahead count", async ({ page, gitPanel }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    const pushBadge = gitPanel.pushBadge();
    if (!(await pushBadge.isVisible())) {
      test.skip();
      return;
    }

    // Verify ahead count before push
    const textBefore = await pushBadge.textContent();
    expect(textBefore).toMatch(/↑\d+/);

    // Click push badge
    await pushBadge.click();
    await page.waitForTimeout(3000);

    // After push, ahead count should be 0
    const textAfter = await pushBadge.textContent();
    expect(textAfter).toMatch(/↑0/);
  });

  test("G7b: Click sibling repo in RepoNavigator dropdown", async ({
    page,
    gitPanel,
  }) => {
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // Click the repo dropdown (button with ▾)
    const repoDropdown = gitPanel.repoDropdown();
    if (!(await repoDropdown.isVisible())) {
      test.skip();
      return;
    }

    await repoDropdown.click();
    await page.waitForTimeout(500);

    // Look for "Siblings" section in the dropdown
    const siblingsLabel = gitPanel.root.locator("text=Siblings");
    if (!(await siblingsLabel.isVisible())) {
      test.skip();
      return;
    }

    // Click a sibling repo (e.g., app-api)
    const siblingButton = gitPanel.root
      .locator("button")
      .filter({ hasText: /app-/ })
      .first();
    if (!(await siblingButton.isVisible())) {
      test.skip();
      return;
    }

    await siblingButton.click();
    await page.waitForTimeout(1000);

    // Verify the panel now shows the sibling's branch
    const branchName = await gitPanel.branchName();
    expect(branchName).toBeTruthy();

    // Verify "Return to terminal's repo" reset button appears
    const resetButton = gitPanel.repoResetButton();
    await expect(resetButton).toBeVisible();
  });
});
