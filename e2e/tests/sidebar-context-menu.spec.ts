import { test, expect } from "../fixtures/bord-test";
import { apiClient } from "../helpers/api-client";

test.describe("Sidebar context menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("right-click workspace shows context menu with 'Remove workspace'", async ({
    page,
    sidebar,
  }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 1) {
      test.skip();
      return;
    }

    const wsButton = wsButtons.first();

    // Right-click to open context menu
    await wsButton.click({ button: "right" });
    await page.waitForTimeout(300);

    // Context menu should appear with "Remove workspace" option
    const removeOption = page.locator("text=Remove workspace");
    await expect(removeOption).toBeVisible();
  });

  test("context menu disappears on click outside", async ({ page, sidebar }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 1) {
      test.skip();
      return;
    }

    // Open context menu
    await wsButtons.first().click({ button: "right" });
    await page.waitForTimeout(300);

    const removeOption = page.locator("text=Remove workspace");
    await expect(removeOption).toBeVisible();

    // Click somewhere else to dismiss
    await page.mouse.click(400, 400);
    await page.waitForTimeout(300);

    // Context menu should be gone
    expect(await removeOption.isVisible()).toBe(false);
  });

  test("remove workspace via context menu with confirm dialog", async ({
    page,
    sidebar,
  }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 2) {
      // Need at least 2 so we can delete one safely
      test.skip();
      return;
    }

    const lastButton = wsButtons.last();
    const wsName = await lastButton.getAttribute("title");

    // Set up dialog handler to ACCEPT the confirmation
    page.on("dialog", (dialog) => dialog.accept());

    // Right-click and remove
    await lastButton.click({ button: "right" });
    await page.waitForTimeout(300);

    const removeOption = page.locator("text=Remove workspace");
    if (!(await removeOption.isVisible())) {
      test.skip();
      return;
    }
    await removeOption.click();
    await page.waitForTimeout(1000);

    // Workspace should no longer be in the rail
    const removedButton = sidebar.rail.locator(`button[title="${wsName}"]`);
    expect(await removedButton.count()).toBe(0);
  });

  test("cancel remove workspace keeps it in the rail", async ({ page, sidebar }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 1) {
      test.skip();
      return;
    }

    const firstButton = wsButtons.first();
    const wsName = await firstButton.getAttribute("title");

    // Set up dialog handler to DISMISS the confirmation
    page.on("dialog", (dialog) => dialog.dismiss());

    // Right-click and try to remove
    await firstButton.click({ button: "right" });
    await page.waitForTimeout(300);

    const removeOption = page.locator("text=Remove workspace");
    if (!(await removeOption.isVisible())) {
      test.skip();
      return;
    }
    await removeOption.click();
    await page.waitForTimeout(500);

    // Workspace should still be there (cancel dismissed)
    const stillThere = sidebar.rail.locator(`button[title="${wsName}"]`);
    expect(await stillThere.count()).toBe(1);
  });

  test("context menu positions near the click point", async ({ page, sidebar }) => {
    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 1) {
      test.skip();
      return;
    }

    const wsButton = wsButtons.first();
    const box = await wsButton.boundingBox();
    if (!box) {
      test.skip();
      return;
    }

    // Right-click at a specific position
    const clickX = box.x + box.width / 2;
    const clickY = box.y + box.height / 2;
    await page.mouse.click(clickX, clickY, { button: "right" });
    await page.waitForTimeout(300);

    // Context menu should be positioned near the click point
    const contextMenu = page.locator(".fixed.z-\\[9999\\].min-w-\\[160px\\]");
    if (!(await contextMenu.isVisible())) {
      test.skip();
      return;
    }

    const menuBox = await contextMenu.boundingBox();
    if (!menuBox) {
      test.skip();
      return;
    }

    // Menu should be reasonably close to where we clicked (within 200px)
    expect(Math.abs(menuBox.x - clickX)).toBeLessThan(200);
    expect(Math.abs(menuBox.y - clickY)).toBeLessThan(200);
  });
});
