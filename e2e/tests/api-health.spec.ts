import { test, expect } from "../fixtures/bord-test";
import { apiClient } from "../helpers/api-client";

test.describe("API health checks", () => {
  test("health endpoint returns ok", async () => {
    const health = await apiClient.health();
    expect(health.status).toBe("ok");
    expect(health.uptime).toBeGreaterThan(0);
    expect(health.timestamp).toBeTruthy();
  });

  test("workspace list includes fixture workspaces", async () => {
    const workspaces = await apiClient.listWorkspaces();
    expect(workspaces.length).toBeGreaterThan(0);

    const names = workspaces.map((w) => w.name);
    // At least one fixture workspace should be registered
    const hasFixture = names.some((n) => n.startsWith("fixture-"));
    expect(hasFixture).toBe(true);
  });

  test("PTY create → list → destroy lifecycle", async () => {
    // Create
    const workspaces = await apiClient.listWorkspaces();
    const cwd = workspaces[0]?.path ?? "/tmp";
    const created = await apiClient.createPty(cwd);
    expect(created.id).toBeTruthy();

    // List — should include the new PTY
    const list = await apiClient.listPty();
    const found = list.some((p) => p.id === created.id);
    expect(found).toBe(true);

    // Destroy
    const destroyed = await apiClient.destroyPty(created.id);
    expect(destroyed.ok).toBe(true);

    // Verify gone
    const listAfter = await apiClient.listPty();
    const stillThere = listAfter.some((p) => p.id === created.id);
    expect(stillThere).toBe(false);
  });

  test("git status returns valid branch for fixture repo", async () => {
    const workspaces = await apiClient.listWorkspaces();
    const fixtureWeb = workspaces.find((w) => w.name === "fixture-web");
    if (!fixtureWeb) {
      test.skip();
      return;
    }

    const status = await apiClient.gitStatus(fixtureWeb.path);
    expect(status.branch).toBeTruthy();
    expect(Array.isArray(status.staged)).toBe(true);
    expect(Array.isArray(status.unstaged)).toBe(true);
    expect(Array.isArray(status.untracked)).toBe(true);
  });
});
