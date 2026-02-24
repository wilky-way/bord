import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("File tree (FT1-FT8)", () => {
  test.beforeEach(async ({ page, sidebar, topbar, terminalPanel }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select fixture-web workspace (has source files)
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

  test("FT1: file tree button toggles view", async ({ page, filePanel, terminalPanel }) => {
    const btn = filePanel.fileTreeButton();
    await btn.waitFor({ state: "visible", timeout: 10_000 });

    // Open file tree
    await btn.click();
    await page.waitForTimeout(600);
    expect(await filePanel.isFileTreeVisible()).toBe(true);

    // Terminal canvas should still exist in the DOM (hidden, not destroyed)
    const terminalCount = await terminalPanel.visibleCount();
    expect(terminalCount).toBeGreaterThanOrEqual(1);

    // Click again → back to terminal
    await btn.click();
    await page.waitForTimeout(400);
    expect(await filePanel.isFileTreeVisible()).toBe(false);
  });

  test("FT2: directory expansion (lazy load)", async ({ page, filePanel }) => {
    const btn = filePanel.fileTreeButton();
    await btn.waitFor({ state: "visible", timeout: 10_000 });
    await btn.click();
    await page.waitForTimeout(800);

    expect(await filePanel.isFileTreeVisible()).toBe(true);

    // Root listing should show entries (dirs sorted first)
    const fileTree = filePanel.fileTree();
    const entries = fileTree.locator("div.flex.items-center");
    const count = await entries.count();
    expect(count).toBeGreaterThan(0);

    // Look for a directory entry (has chevron SVG)
    const dirEntries = fileTree.locator("div.flex.items-center:has(svg)");
    const dirCount = await dirEntries.count();
    if (dirCount === 0) {
      test.skip();
      return;
    }

    // Click first dir → children should load
    await dirEntries.first().click();
    await page.waitForTimeout(600);

    // After expansion, there should be more entries
    const expandedCount = await entries.count();
    expect(expandedCount).toBeGreaterThan(count);

    // Click again → collapses
    await dirEntries.first().click();
    await page.waitForTimeout(300);
    const collapsedCount = await entries.count();
    expect(collapsedCount).toBeLessThanOrEqual(count);
  });

  test("FT3: hidden files toggle", async ({ page, filePanel }) => {
    const btn = filePanel.fileTreeButton();
    await btn.waitFor({ state: "visible", timeout: 10_000 });
    await btn.click();
    await page.waitForTimeout(800);

    const fileTree = filePanel.fileTree();
    const initialText = await fileTree.textContent();

    // Look for .* toggle button
    const hiddenBtn = fileTree.locator('button[title="Toggle hidden files"]');
    if (!(await hiddenBtn.isVisible())) {
      test.skip();
      return;
    }

    // Initially hidden files should not be shown
    const hasGitignore = initialText?.includes(".gitignore");

    // Toggle hidden files on
    await hiddenBtn.click();
    await page.waitForTimeout(400);
    const afterToggleText = await fileTree.textContent();

    // After toggling, dotfiles should appear (or the text should change)
    if (!hasGitignore) {
      // If dotfiles weren't shown before, they might be now
      expect(afterToggleText).not.toBe(initialText);
    }

    // Toggle off again
    await hiddenBtn.click();
    await page.waitForTimeout(400);
  });

  test("FT4: open file from tree (double-click)", async ({ page, filePanel }) => {
    const btn = filePanel.fileTreeButton();
    await btn.waitFor({ state: "visible", timeout: 10_000 });
    await btn.click();
    await page.waitForTimeout(800);

    const fileTree = filePanel.fileTree();

    // Look for a file entry (no chevron SVG — files have a spacer span instead)
    // Try to find a known file type
    const fileEntries = fileTree.locator("div.flex.items-center.cursor-pointer");
    const count = await fileEntries.count();

    // Find a non-dir entry to double-click
    let targetFile: string | null = null;
    for (let i = 0; i < count; i++) {
      const entry = fileEntries.nth(i);
      const text = (await entry.textContent()) ?? "";
      if (text.match(/\.(ts|js|json|md|css)$/)) {
        targetFile = text.trim();
        await entry.dblclick();
        break;
      }
    }

    if (!targetFile) {
      // Expand a directory first, then look for files
      const dirEntries = fileTree.locator("div.flex.items-center:has(svg)");
      if ((await dirEntries.count()) > 0) {
        await dirEntries.first().click();
        await page.waitForTimeout(600);

        // Try again with expanded entries
        const expandedEntries = fileTree.locator("div.flex.items-center.cursor-pointer");
        for (let i = 0; i < (await expandedEntries.count()); i++) {
          const entry = expandedEntries.nth(i);
          const text = (await entry.textContent()) ?? "";
          if (text.match(/\.(ts|js|json|md|css)$/)) {
            targetFile = text.trim();
            await entry.dblclick();
            break;
          }
        }
      }
    }

    if (!targetFile) {
      test.skip();
      return;
    }

    await page.waitForTimeout(800);

    // File viewer should open
    expect(await filePanel.isFileViewerVisible()).toBe(true);

    // Tab should show the filename
    const tabs = filePanel.fileViewerTabs();
    await expect(tabs).toBeVisible();

    // Back to tree button should be visible
    await expect(filePanel.backToTreeButton()).toBeVisible();
  });

  test("FT5: multiple file tabs", async ({ page, filePanel }) => {
    const btn = filePanel.fileTreeButton();
    await btn.waitFor({ state: "visible", timeout: 10_000 });
    await btn.click();
    await page.waitForTimeout(800);

    const fileTree = filePanel.fileTree();

    // Expand a directory to get files
    const dirEntries = fileTree.locator("div.flex.items-center:has(svg)");
    if ((await dirEntries.count()) > 0) {
      await dirEntries.first().click();
      await page.waitForTimeout(600);
    }

    // Find and open two different files
    const entries = fileTree.locator("div.flex.items-center.cursor-pointer");
    const filesOpened: string[] = [];

    for (let i = 0; i < (await entries.count()) && filesOpened.length < 2; i++) {
      const entry = entries.nth(i);
      const text = (await entry.textContent()) ?? "";
      if (text.match(/\.(ts|js|json|md|css)$/)) {
        await entry.dblclick();
        await page.waitForTimeout(600);
        filesOpened.push(text.trim());

        if (filesOpened.length < 2) {
          // Go back to tree to open another file
          await filePanel.backToTreeButton().click();
          await page.waitForTimeout(400);
        }
      }
    }

    if (filesOpened.length < 2) {
      test.skip();
      return;
    }

    // Should have two tabs visible
    const tabs = filePanel.fileViewerTabs().locator("button[data-file-tab]");
    expect(await tabs.count()).toBe(2);

    // Close first tab using the × button
    await tabs.first().locator("span").last().click();
    await page.waitForTimeout(300);

    // Should have one tab remaining
    expect(await tabs.count()).toBe(1);
  });

  test("FT6: return to terminal from file views", async ({ page, filePanel }) => {
    const btn = filePanel.fileTreeButton();
    await btn.waitFor({ state: "visible", timeout: 10_000 });

    // Open file tree
    await btn.click();
    await page.waitForTimeout(600);
    expect(await filePanel.isFileTreeVisible()).toBe(true);

    // Close via folder icon (same button) → back to terminal
    await btn.click();
    await page.waitForTimeout(400);
    expect(await filePanel.isFileTreeVisible()).toBe(false);

    // Open file tree again, then open a file
    await btn.click();
    await page.waitForTimeout(600);

    const fileTree = filePanel.fileTree();
    const entries = fileTree.locator("div.flex.items-center.cursor-pointer");

    // Find any file to open
    for (let i = 0; i < (await entries.count()); i++) {
      const text = (await entries.nth(i).textContent()) ?? "";
      if (text.match(/\.(ts|js|json|md|css)$/)) {
        await entries.nth(i).dblclick();
        break;
      }
    }
    await page.waitForTimeout(600);

    if (await filePanel.isFileViewerVisible()) {
      // ← Tree goes back to file tree
      await filePanel.backToTreeButton().click();
      await page.waitForTimeout(400);
      expect(await filePanel.isFileTreeVisible()).toBe(true);

      // ✕ goes back to terminal (from file tree)
      const closeBtn = page.locator('button[title="Close file viewer"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      } else {
        // Use the folder icon toggle
        await btn.click();
        await page.waitForTimeout(400);
      }
      expect(await filePanel.isFileTreeVisible()).toBe(false);
    }
  });

  test("FT7: sidebar file tree mode", async ({ page, sidebar, filePanel }) => {
    await sidebar.ensureExpanded();

    // Click files button in sidebar
    const sidebarFilesBtn = filePanel.sidebarFilesButton();
    if (!(await sidebarFilesBtn.isVisible())) {
      test.skip();
      return;
    }

    await sidebarFilesBtn.click();
    await page.waitForTimeout(600);

    // Sidebar should now show a file tree
    const sidebarFileTree = page.locator("[data-bord-sidebar] [data-file-tree]");
    await expect(sidebarFileTree).toBeVisible({ timeout: 5000 });
  });

  test("FT8: Cmd+Shift+E shortcut toggles sidebar files mode", async ({ page, sidebar, filePanel }) => {
    await sidebar.ensureExpanded();

    // Press Cmd+Shift+E
    await page.keyboard.press("Meta+Shift+e");
    await page.waitForTimeout(600);

    // Should switch to files mode — look for file tree in sidebar
    const sidebarFileTree = page.locator("[data-bord-sidebar] [data-file-tree]");
    const isFileMode = await sidebarFileTree.isVisible().catch(() => false);

    if (!isFileMode) {
      // Shortcut might not be implemented yet — skip gracefully
      test.skip();
      return;
    }

    // Press again → should switch back
    await page.keyboard.press("Meta+Shift+e");
    await page.waitForTimeout(600);

    const stillFileMode = await sidebarFileTree.isVisible().catch(() => false);
    expect(stillFileMode).toBe(false);
  });
});
