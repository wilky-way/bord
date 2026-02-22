import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Editor integration (E1-E2)", () => {
  test.beforeEach(async ({ page, sidebar, topbar, terminalPanel }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select fixture workspace
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
  });

  test("E1: EditorButton is visible on terminal titlebar", async ({ page, terminalPanel }) => {
    // Scope to the terminal panel titlebar to avoid picking up the sidebar editor button
    const panel = terminalPanel.allPanels().first();
    const editorDropdown = panel.locator(sel.chooseEditorButton);
    await expect(editorDropdown).toBeVisible();
  });

  test("E2: clicking Choose editor shows VS Code / Cursor options", async ({
    page,
    terminalPanel,
  }) => {
    const panel = terminalPanel.allPanels().first();
    const editorDropdown = panel.locator(sel.chooseEditorButton);
    await editorDropdown.click();
    await page.waitForTimeout(300);

    // Dropdown should show VS Code and Cursor options (dropdown is rendered in the same container)
    const vsCodeOption = page.locator("button:has-text('VS Code')");
    const cursorOption = page.locator("button:has-text('Cursor')");

    expect(await vsCodeOption.isVisible()).toBe(true);
    expect(await cursorOption.isVisible()).toBe(true);
  });

  test("E2b: selecting Cursor changes active editor", async ({ page, terminalPanel }) => {
    const panel = terminalPanel.allPanels().first();
    const editorDropdown = panel.locator(sel.chooseEditorButton);
    await editorDropdown.click();
    await page.waitForTimeout(300);

    // Click Cursor option
    const cursorOption = page.locator("button:has-text('Cursor')");
    if (await cursorOption.isVisible()) {
      await cursorOption.click();
      await page.waitForTimeout(300);

      // Re-open dropdown to verify Cursor is now active (has accent color)
      await editorDropdown.click();
      await page.waitForTimeout(300);

      const cursorBtn = page.locator("button:has-text('Cursor')");
      const classes = await cursorBtn.getAttribute("class");
      expect(classes).toContain("accent");
    }
  });
});
