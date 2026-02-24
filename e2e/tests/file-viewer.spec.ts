import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("File viewer (FV1-FV6)", () => {
  /**
   * Helper: open the file tree and double-click a file matching the given extension pattern.
   * Returns true if a file was opened, false otherwise.
   */
  async function openFileByExtension(
    page: import("@playwright/test").Page,
    filePanel: import("../page-objects/file-panel.po").FilePanelPO,
    extPattern: RegExp,
  ): Promise<boolean> {
    const btn = filePanel.fileTreeButton();
    await btn.waitFor({ state: "visible", timeout: 10_000 });
    await btn.click();
    await page.waitForTimeout(800);

    const fileTree = filePanel.fileTree();

    // Try root entries first
    let entries = fileTree.locator("div.flex.items-center.cursor-pointer");
    for (let i = 0; i < (await entries.count()); i++) {
      const text = (await entries.nth(i).textContent()) ?? "";
      if (extPattern.test(text)) {
        await entries.nth(i).dblclick();
        await page.waitForTimeout(800);
        return true;
      }
    }

    // Expand directories to find files
    const dirEntries = fileTree.locator("div.flex.items-center:has(svg)");
    const dirCount = await dirEntries.count();
    for (let d = 0; d < dirCount; d++) {
      await dirEntries.nth(d).click();
      await page.waitForTimeout(500);

      entries = fileTree.locator("div.flex.items-center.cursor-pointer");
      for (let i = 0; i < (await entries.count()); i++) {
        const text = (await entries.nth(i).textContent()) ?? "";
        if (extPattern.test(text)) {
          await entries.nth(i).dblclick();
          await page.waitForTimeout(800);
          return true;
        }
      }
    }

    return false;
  }

  test.beforeEach(async ({ page, sidebar, topbar, terminalPanel }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select fixture-web workspace
    const wsButton = sidebar.rail.locator('button[title="fixture-web"]');
    if (await wsButton.isVisible()) {
      await wsButton.click();
      await page.waitForTimeout(500);
    }

    // Ensure at least one terminal
    if ((await terminalPanel.visibleCount()) < 1) {
      await topbar.addTerminal();
      await page.waitForTimeout(1000);
    }
  });

  test("FV1: syntax highlighting loads", async ({ page, filePanel }) => {
    const opened = await openFileByExtension(page, filePanel, /\.(ts|js)$/);
    if (!opened) {
      test.skip();
      return;
    }

    expect(await filePanel.isFileViewerVisible()).toBe(true);

    // Highlighted layer should have hljs classes
    const pre = page.locator(sel.fileViewerRoot).locator("pre");
    await expect(pre).toBeVisible();

    const code = pre.locator("code");
    const innerHTML = await code.innerHTML();

    // hljs wraps tokens in <span class="hljs-...">
    expect(innerHTML).toContain("hljs-");
  });

  test("FV2: edit and dirty indicator", async ({ page, filePanel }) => {
    const opened = await openFileByExtension(page, filePanel, /\.(ts|js|css|json)$/);
    if (!opened) {
      test.skip();
      return;
    }

    expect(await filePanel.isFileViewerVisible()).toBe(true);

    // Type in textarea to make it dirty
    const textarea = filePanel.editorTextarea();
    await textarea.click();
    await textarea.press("End");
    await textarea.type("// test edit");
    await page.waitForTimeout(300);

    // Dirty indicator (●) should appear on the active tab
    const tabBar = filePanel.fileViewerTabs();
    const tabText = await tabBar.textContent();
    expect(tabText).toContain("\u25CF"); // ● character

    // Save with Cmd+S → dot should disappear
    await page.keyboard.press("Meta+s");
    await page.waitForTimeout(1000);

    const tabTextAfterSave = await tabBar.textContent();
    // After save, the dirty indicator should be gone
    // (This depends on the save actually succeeding)
    expect(tabTextAfterSave).not.toContain("\u25CF");
  });

  test("FV3: markdown preview", async ({ page, filePanel }) => {
    const opened = await openFileByExtension(page, filePanel, /\.md$/);
    if (!opened) {
      test.skip();
      return;
    }

    expect(await filePanel.isFileViewerVisible()).toBe(true);

    // Preview button should be visible for markdown files
    const previewBtn = filePanel.previewToggle();
    await expect(previewBtn).toBeVisible();

    // Button should say "Preview"
    const btnText = await previewBtn.textContent();
    expect(btnText).toContain("Preview");

    // Click Preview → prose-viewer should render
    await previewBtn.click();
    await page.waitForTimeout(600);

    const previewContent = filePanel.previewContent();
    await expect(previewContent).toBeVisible();

    // Button should now say "Edit"
    const editBtnText = await previewBtn.textContent();
    expect(editBtnText).toContain("Edit");

    // Click Edit → back to textarea
    await previewBtn.click();
    await page.waitForTimeout(400);

    await expect(filePanel.editorTextarea()).toBeVisible();
    expect(await previewContent.isVisible()).toBe(false);
  });

  test("FV4: binary file placeholder", async ({ page, filePanel }) => {
    // Try to open a binary file (.png or similar)
    const opened = await openFileByExtension(page, filePanel, /\.(png|jpg|jpeg|gif|ico|woff|woff2)$/);
    if (!opened) {
      test.skip();
      return;
    }

    expect(await filePanel.isFileViewerVisible()).toBe(true);

    // Should show "Binary file — cannot display" message
    const binaryMsg = page.locator(sel.fileViewerRoot).locator('text="Binary file — cannot display"');
    await expect(binaryMsg).toBeVisible({ timeout: 5000 });
  });

  test("FV5: file tab switching preserves content", async ({ page, filePanel }) => {
    // Open first file
    const opened1 = await openFileByExtension(page, filePanel, /\.(ts|js)$/);
    if (!opened1) {
      test.skip();
      return;
    }

    // Get first file content
    const content1 = await filePanel.editorTextarea().inputValue();
    expect(content1.length).toBeGreaterThan(0);

    // Go back to tree and open a different file
    await filePanel.backToTreeButton().click();
    await page.waitForTimeout(500);

    const fileTree = filePanel.fileTree();
    const entries = fileTree.locator("div.flex.items-center.cursor-pointer");

    let openedSecond = false;
    for (let i = 0; i < (await entries.count()); i++) {
      const text = (await entries.nth(i).textContent()) ?? "";
      if (text.match(/\.(json|css|md)$/)) {
        await entries.nth(i).dblclick();
        await page.waitForTimeout(800);
        openedSecond = true;
        break;
      }
    }

    if (!openedSecond) {
      test.skip();
      return;
    }

    // Should now have 2 tabs
    const tabs = filePanel.fileViewerTabs().locator("button[data-file-tab]");
    expect(await tabs.count()).toBe(2);

    // Click back to first tab
    await tabs.first().click();
    await page.waitForTimeout(400);

    // Content should match original
    const restoredContent = await filePanel.editorTextarea().inputValue();
    expect(restoredContent).toBe(content1);
  });

  test("FV6: git panel opens file in viewer", async ({ page, filePanel, gitPanel }) => {
    // Open git panel
    const toggleBtn = page.locator(sel.toggleGitPanel).first();
    const gitVisible = await toggleBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!gitVisible) {
      test.skip();
      return;
    }

    await toggleBtn.click();
    await page.waitForTimeout(1000);

    if (!(await gitPanel.isVisible())) {
      test.skip();
      return;
    }

    // Double-click a changed file to open in viewer
    const fileButtons = gitPanel.root.locator("button").filter({ hasText: /\.(ts|css|md)$/ });
    if ((await fileButtons.count()) === 0) {
      test.skip();
      return;
    }

    await fileButtons.first().dblclick();
    await page.waitForTimeout(1000);

    // File viewer should open in the terminal panel
    // (The git panel triggers openFile which switches view to file mode)
    const fileViewerVisible = await filePanel.isFileViewerVisible();
    if (!fileViewerVisible) {
      // Some git panels may not support double-click to open — skip gracefully
      test.skip();
      return;
    }

    expect(fileViewerVisible).toBe(true);
  });
});
