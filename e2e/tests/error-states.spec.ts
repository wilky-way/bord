import { test, expect } from "../fixtures/bord-test";

test.describe("Error states", () => {
  test("git panel on non-repo workspace shows no branch badge", async ({
    page,
    sidebar,
    topbar,
    terminalPanel,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Look for a fixture workspace that is NOT a git repo
    // fixture-plain should be a non-repo workspace if it exists
    const allWsButtons = sidebar.rail.locator("button[title^='fixture-']");
    const count = await allWsButtons.count();

    // Try each workspace — find one where git badge doesn't appear
    let foundNonRepo = false;
    for (let i = 0; i < count; i++) {
      const btn = allWsButtons.nth(i);
      const name = await btn.getAttribute("title");
      await btn.click();
      await page.waitForTimeout(500);

      // Ensure at least one terminal
      if ((await terminalPanel.visibleCount()) < 1) {
        await topbar.addTerminal();
        await page.waitForTimeout(1000);
      }

      // Check if git toggle button exists (branch badge)
      const gitToggle = page.locator('button[title="Toggle git panel"]').first();
      await page.waitForTimeout(2000); // Wait for git status fetch

      if (!(await gitToggle.isVisible())) {
        // This workspace is not a git repo — no branch badge
        foundNonRepo = true;

        // Verify no crash — terminal should still be functional
        expect(await terminalPanel.visibleCount()).toBeGreaterThanOrEqual(1);
        break;
      }
    }

    if (!foundNonRepo) {
      // All fixture workspaces are git repos — skip gracefully
      test.skip();
    }
  });

  test("API /api/git/status on invalid cwd returns error gracefully", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Direct API call with a non-existent path
    const response = await page.request.get(
      "http://localhost:4200/api/git/status?cwd=/nonexistent/path/does/not/exist",
    );

    // Should return an error status (400 or 500), not crash
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("API /api/pty DELETE on non-existent ID returns error", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const response = await page.request.delete(
      "http://localhost:4200/api/pty/nonexistent-pty-id-12345",
    );

    // Should return 404 or similar, not crash
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("API /api/workspaces DELETE on non-existent ID returns error", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const response = await page.request.delete(
      "http://localhost:4200/api/workspaces/nonexistent-ws-id-12345",
    );

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("API /api/git/commit with no staged files returns error", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Try to commit on a clean repo with no staged changes
    const response = await page.request.post("http://localhost:4200/api/git/commit", {
      data: { cwd: "/tmp", message: "test commit" },
    });

    // Should fail gracefully (400 or 500)
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("WebSocket to non-existent PTY closes gracefully", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Attempt to connect a WS to a PTY that doesn't exist
    const result = await page.evaluate(async () => {
      return new Promise<{ code: number; reason: string }>((resolve) => {
        const ws = new WebSocket("ws://localhost:4200/ws/pty/fake-pty-99999");
        ws.onclose = (ev) => resolve({ code: ev.code, reason: ev.reason });
        ws.onerror = () => resolve({ code: 0, reason: "error" });
        // Timeout fallback
        setTimeout(() => resolve({ code: -1, reason: "timeout" }), 5000);
      });
    });

    // WS should close (not hang forever)
    expect(result.code).not.toBe(-1); // Should not timeout
  });
});
