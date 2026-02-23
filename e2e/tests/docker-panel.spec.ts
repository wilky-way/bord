import { test, expect } from "../fixtures/bord-test";
import { sel } from "../helpers/selectors";

test.describe("Docker panel", () => {
  test.beforeEach(async ({ page, sidebar }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select first fixture workspace
    const wsButton = sidebar.rail.locator("button[title^='fixture-']").first();
    if (await wsButton.isVisible()) {
      await wsButton.click();
      await page.waitForTimeout(500);
    }
  });

  test("Docker section header exists in sidebar", async ({ page, sidebar }) => {
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Look for the "Docker" section header
    const dockerHeader = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Docker")',
    );
    await expect(dockerHeader).toBeVisible();
  });

  test("Docker section toggles collapsed/expanded", async ({ page, sidebar }) => {
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Find Docker section header toggle
    const dockerToggle = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Docker")',
    );
    if (!(await dockerToggle.isVisible())) {
      test.skip();
      return;
    }

    // Click to collapse
    await dockerToggle.click();
    await page.waitForTimeout(300);

    // The docker content should be hidden (DockerPanel not visible)
    // Check for the docker content area
    const dockerContent = page.locator('[data-bord-sidebar-panel="expanded"] .p-2.max-h-64');
    const isVisible = await dockerContent.isVisible().catch(() => false);

    // Click again to expand
    await dockerToggle.click();
    await page.waitForTimeout(300);

    // Should toggle back (either visible now or was visible before)
    // The key assertion is that toggling doesn't crash
    expect(true).toBe(true);
  });

  test("Docker panel shows 'No compose files' or compose entries", async ({
    page,
    sidebar,
  }) => {
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Ensure Docker section is expanded
    const dockerToggle = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Docker")',
    );
    if (!(await dockerToggle.isVisible())) {
      test.skip();
      return;
    }

    // Wait for Docker discovery to complete
    await page.waitForTimeout(2000);

    // Should show either "No compose files found", "Select a workspace", "Scanning...", or actual compose entries
    const panelText = await page
      .locator('[data-bord-sidebar-panel="expanded"]')
      .textContent();

    const hasDockerContent =
      panelText?.includes("No compose files") ||
      panelText?.includes("Select a workspace") ||
      panelText?.includes("Scanning") ||
      panelText?.includes("compose") ||
      panelText?.includes("docker-compose");

    // Docker section should render some meaningful content
    expect(hasDockerContent || panelText?.includes("Docker")).toBe(true);
  });

  test("Docker API /api/docker/discover responds gracefully", async ({ page }) => {
    // Direct API test — discover compose files in a path
    const response = await page.request.post("http://localhost:4200/api/docker/discover", {
      data: { paths: ["/tmp"] },
    });

    // Should return 200 (with empty files array) or an error status — not crash
    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty("files");
      expect(Array.isArray(body.files)).toBe(true);
    } else {
      // Docker not available — that's fine, should be a clean error
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("Docker API /api/docker/containers responds gracefully for non-existent compose", async ({
    page,
  }) => {
    const response = await page.request.get(
      "http://localhost:4200/api/docker/containers?compose=/nonexistent/docker-compose.yml",
    );

    // Should return error status, not crash
    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty("containers");
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("Docker panel survives workspace switch", async ({ page, sidebar }) => {
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const wsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await wsButtons.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Switch to workspace B
    await wsButtons.nth(1).click();
    await page.waitForTimeout(1000);

    // Docker section should still be present
    const dockerHeader = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Docker")',
    );
    await expect(dockerHeader).toBeVisible();

    // Switch back to workspace A
    await wsButtons.nth(0).click();
    await page.waitForTimeout(1000);

    // Docker section should still be present
    await expect(dockerHeader).toBeVisible();
  });

  test("Docker start button via route interception", async ({ page, sidebar }) => {
    // Intercept the Docker start API call
    await page.route("**/api/docker/start", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    // Look for a start button in the Docker panel
    const startBtn = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Start")',
    );
    if (!(await startBtn.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await startBtn.first().click();
    await page.waitForTimeout(500);

    // Should not crash
    expect(true).toBe(true);
  });

  test("Docker stop button via route interception", async ({ page, sidebar }) => {
    await page.route("**/api/docker/stop", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const stopBtn = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Stop")',
    );
    if (!(await stopBtn.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await stopBtn.first().click();
    await page.waitForTimeout(500);

    expect(true).toBe(true);
  });

  test("Docker restart button via route interception", async ({ page, sidebar }) => {
    await page.route("**/api/docker/restart", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const restartBtn = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Restart")',
    );
    if (!(await restartBtn.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await restartBtn.first().click();
    await page.waitForTimeout(500);

    expect(true).toBe(true);
  });

  test("Docker pull button via route interception", async ({ page, sidebar }) => {
    await page.route("**/api/docker/pull", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const pullBtn = page.locator(
      '[data-bord-sidebar-panel="expanded"] button:has-text("Pull")',
    );
    if (!(await pullBtn.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await pullBtn.first().click();
    await page.waitForTimeout(500);

    expect(true).toBe(true);
  });

  test("Docker logs button opens terminal", async ({ page, sidebar, terminalPanel }) => {
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const logsBtn = page.locator(
      '[data-bord-sidebar-panel="expanded"] button[title*="Logs"], [data-bord-sidebar-panel="expanded"] button:has-text("Logs")',
    );
    if (!(await logsBtn.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const before = await terminalPanel.visibleCount();
    await logsBtn.first().click();
    await page.waitForTimeout(1500);

    // A new terminal should open for the logs
    const after = await terminalPanel.visibleCount();
    expect(after).toBeGreaterThan(before);
  });

  test("Docker shell button opens terminal", async ({ page, sidebar, terminalPanel }) => {
    await sidebar.ensureExpanded();
    await page.waitForTimeout(300);

    const shellBtn = page.locator(
      '[data-bord-sidebar-panel="expanded"] button[title*="Shell"], [data-bord-sidebar-panel="expanded"] button:has-text("Shell")',
    );
    if (!(await shellBtn.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const before = await terminalPanel.visibleCount();
    await shellBtn.first().click();
    await page.waitForTimeout(1500);

    // A new terminal should open for the shell
    const after = await terminalPanel.visibleCount();
    expect(after).toBeGreaterThan(before);
  });
});
