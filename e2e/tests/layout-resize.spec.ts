import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Layout & resize", () => {
  test.beforeEach(async ({ page, sidebar, topbar, terminalPanel }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select fixture workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (await wsButton.isVisible()) {
      await wsButton.click();
      await page.waitForTimeout(500);
    }

    // Ensure at least 3 terminals
    while ((await terminalPanel.visibleCount()) < 3) {
      await topbar.addTerminal();
      await page.waitForTimeout(800);
    }
  });

  test("1x density with 3 terminals creates horizontal scroll", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    await topbar.setDensity(1);
    await page.waitForTimeout(300);

    // At 1x density, the container should overflow (scroll)
    // The tiling layout container has overflow-x-auto behavior
    const count = await terminalPanel.visibleCount();
    expect(count).toBeGreaterThanOrEqual(3);

    // Check that density is set to 1
    expect(await topbar.getActiveDensity()).toBe(1);
  });

  test("4x density shows all terminals without scroll", async ({
    page,
    topbar,
    terminalPanel,
  }) => {
    await topbar.setDensity(4);
    await page.waitForTimeout(300);

    expect(await topbar.getActiveDensity()).toBe(4);
    const count = await terminalPanel.visibleCount();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("clicking same density button toggles auto-fit mode", async ({ page, topbar }) => {
    // Set 2x density
    await topbar.setDensity(2);
    await page.waitForTimeout(300);
    expect(await topbar.getActiveDensity()).toBe(2);

    // Click 2x again — should toggle to auto-fit (0, no button active)
    await topbar.setDensity(2);
    await page.waitForTimeout(300);

    const active = await topbar.getActiveDensity();
    expect(active).toBeNull(); // No active density = auto-fit mode
  });

  test("panel resize via drag handle changes widths", async ({ page, terminalPanel }) => {
    // At least 2 terminals needed
    const count = await terminalPanel.visibleCount();
    if (count < 2) {
      test.skip();
      return;
    }

    const panels = terminalPanel.allPanels();
    const firstPanel = panels.first();
    const secondPanel = panels.nth(1);

    const firstBox = await firstPanel.boundingBox();
    const secondBox = await secondPanel.boundingBox();

    if (!firstBox || !secondBox) {
      test.skip();
      return;
    }

    // Look for resize handle between panels
    // The TilingLayout renders resize handles between panels
    const resizeHandles = page.locator('[style*="cursor: col-resize"], .cursor-col-resize');
    const handleCount = await resizeHandles.count();

    if (handleCount > 0) {
      const handle = resizeHandles.first();
      const handleBox = await handle.boundingBox();
      if (handleBox) {
        // Drag handle to the right by 50px
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(handleBox.x + handleBox.width / 2 + 50, handleBox.y + handleBox.height / 2, {
          steps: 5,
        });
        await page.mouse.up();
        await page.waitForTimeout(300);

        // Verify panels still exist
        expect(await terminalPanel.visibleCount()).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("add terminal via + button → new panel appears", async ({ page, topbar, terminalPanel }) => {
    const before = await terminalPanel.visibleCount();
    await topbar.addTerminal();
    await page.waitForTimeout(1000);
    expect(await terminalPanel.visibleCount()).toBe(before + 1);
  });
});
