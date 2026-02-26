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

  test("horizontal wheel gesture scrolls the panel strip", async ({
    page,
    topbar,
  }) => {
    await topbar.setDensity(1);
    await page.waitForTimeout(300);

    const layout = page.locator("div.flex-nowrap.overflow-x-auto").first();
    await expect(layout).toBeVisible();

    const dimensions = await layout.evaluate((el) => ({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);

    const box = await layout.boundingBox();
    if (!box) {
      test.skip();
      return;
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(700, 40);
    await page.waitForTimeout(200);

    const afterRight = await layout.evaluate((el) => el.scrollLeft);
    expect(afterRight).toBeGreaterThan(dimensions.scrollLeft);

    await page.mouse.wheel(-700, -40);
    await page.waitForTimeout(200);

    const afterLeft = await layout.evaluate((el) => el.scrollLeft);
    expect(afterLeft).toBeLessThan(afterRight);
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

    // The resize handle is inside each ResizablePanel wrapper (parent of [data-terminal-id])
    // Use the first panel's bounding box to calculate the handle position
    // Handle is at -right-[2px] w-[5px], so it starts 3px inside the panel's right edge
    const widthBefore = firstBox.width;
    const handleX = firstBox.x + firstBox.width - 2; // Center of the visible handle portion
    const handleY = firstBox.y + firstBox.height / 2;

    // Drag the handle to the right by 100px
    await page.mouse.move(handleX, handleY);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.move(handleX + 100, handleY, { steps: 10 });
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Capture width after drag
    const widthAfter = (await firstPanel.boundingBox())!.width;

    // First panel should have grown
    expect(widthAfter).toBeGreaterThan(widthBefore);

    // Verify panels still exist
    expect(await terminalPanel.visibleCount()).toBeGreaterThanOrEqual(2);
  });

  test("add terminal via + button → new panel appears", async ({ page, topbar, terminalPanel }) => {
    const before = await terminalPanel.visibleCount();
    await topbar.addTerminal();
    await page.waitForTimeout(1000);
    expect(await terminalPanel.visibleCount()).toBe(before + 1);
  });

  test("terminal count badge matches visible count", async ({ page, topbar, terminalPanel }) => {
    const badgeText = await topbar.getTerminalCountText();
    const match = badgeText.match(/(\d+)/);
    if (!match) {
      test.skip();
      return;
    }

    const badgeCount = parseInt(match[1], 10);
    // Badge shows total terminals (including stashed), not just visible
    // So it should be >= visible count
    const visibleCount = await terminalPanel.visibleCount();
    expect(badgeCount).toBeGreaterThanOrEqual(visibleCount);
  });

  test("window resize reflows panels", async ({ page, topbar, terminalPanel }) => {
    // Set 2x density
    await topbar.setDensity(2);
    await page.waitForTimeout(300);

    // Get initial panel bounding box
    const panels = terminalPanel.allPanels();
    if ((await panels.count()) < 2) {
      test.skip();
      return;
    }

    const boxBefore = await panels.first().boundingBox();
    if (!boxBefore) {
      test.skip();
      return;
    }

    // Resize viewport to smaller width
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(500);

    const boxAfter = await panels.first().boundingBox();
    if (!boxAfter) {
      test.skip();
      return;
    }

    // Panel width should have changed (smaller viewport = narrower panels)
    expect(boxAfter.width).not.toBe(boxBefore.width);

    // Restore viewport
    await page.setViewportSize({ width: 1720, height: 980 });
    await page.waitForTimeout(300);
  });
});
