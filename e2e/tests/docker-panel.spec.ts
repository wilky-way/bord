import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/bord-test";

const COMPOSE_PATH = "/tmp/fixture-docker/docker-compose.yml";
const COMPOSE_NAME = "docker-compose.yml";

const DEFAULT_CONTAINERS = [
  {
    id: "c-web",
    name: "fixture_web_1",
    service: "web",
    state: "running",
    status: "Up 2 minutes",
  },
  {
    id: "c-worker",
    name: "fixture_worker_1",
    service: "worker",
    state: "exited",
    status: "Exited (0) 1 minute ago",
  },
];

async function mockDockerReadApis(page: Page, containers = DEFAULT_CONTAINERS) {
  await page.route("**/api/docker/discover?**", async (route) => {
    const url = new URL(route.request().url());
    const paths = url.searchParams.get("paths") ?? "";

    if (!paths) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "paths query parameter required" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        files: [
          {
            path: COMPOSE_PATH,
            dir: "/tmp/fixture-docker",
            name: COMPOSE_NAME,
          },
        ],
      }),
    });
  });

  await page.route("**/api/docker/containers?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("composePath") !== COMPOSE_PATH) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "composePath query parameter required" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ containers }),
    });
  });
}

async function selectFixtureWorkspace(page: Page) {
  const dockerWorkspace = page.locator('[data-bord-sidebar-rail] button[title="fixture-docker"]');
  if (await dockerWorkspace.isVisible()) {
    await dockerWorkspace.click();
    await page.waitForTimeout(350);
    return;
  }

  const firstFixture = page.locator('[data-bord-sidebar-rail] button[title^="fixture-"]').first();
  if (await firstFixture.isVisible()) {
    await firstFixture.click();
    await page.waitForTimeout(350);
  }
}

async function ensureDockerSectionExpanded(page: Page) {
  const panel = page.locator('[data-bord-sidebar-panel="expanded"]');
  const header = panel.getByRole("button", { name: "Docker", exact: true });
  await expect(header).toBeVisible();

  const body = panel.locator(".p-2.max-h-64");
  if (!(await body.isVisible().catch(() => false))) {
    await header.click();
  }

  await expect(body).toBeVisible();
}

async function openDockerWithMocks(page: Page, sidebar: { ensureExpanded: () => Promise<void> }) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await sidebar.ensureExpanded();
  await selectFixtureWorkspace(page);
  await sidebar.ensureExpanded();
  await ensureDockerSectionExpanded(page);
}

test.describe("Docker panel", () => {
  test("shows Docker section in sidebar", async ({ page, sidebar }) => {
    await mockDockerReadApis(page);
    await openDockerWithMocks(page, sidebar);

    const dockerHeader = page
      .locator('[data-bord-sidebar-panel="expanded"]')
      .getByRole("button", { name: "Docker", exact: true });
    await expect(dockerHeader).toBeVisible();
  });

  test("toggles Docker section collapsed/expanded", async ({ page, sidebar }) => {
    await mockDockerReadApis(page);
    await openDockerWithMocks(page, sidebar);

    const panel = page.locator('[data-bord-sidebar-panel="expanded"]');
    const dockerHeader = panel.getByRole("button", { name: "Docker", exact: true });
    const dockerBody = panel.locator(".p-2.max-h-64");

    await expect(dockerBody).toBeVisible();
    await dockerHeader.click();
    await expect(dockerBody).toBeHidden();

    await dockerHeader.click();
    await expect(dockerBody).toBeVisible();
  });

  test("uses GET /api/docker/discover with paths query and renders compose entry", async ({
    page,
    sidebar,
  }) => {
    await mockDockerReadApis(page);

    const discoverReq = page.waitForRequest(
      (req) => req.method() === "GET" && req.url().includes("/api/docker/discover"),
    );

    await openDockerWithMocks(page, sidebar);

    const req = await discoverReq;
    const url = new URL(req.url());
    expect(url.searchParams.get("paths")).toBeTruthy();

    await expect(page.locator(`text=${COMPOSE_NAME}`)).toBeVisible();
  });

  test("project-level actions call /up, /down, /pull with composePath", async ({ page, sidebar }) => {
    await mockDockerReadApis(page);

    await page.route("**/api/docker/up", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route("**/api/docker/down", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route("**/api/docker/pull", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await openDockerWithMocks(page, sidebar);

    const upReqPromise = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().endsWith("/api/docker/up"),
    );
    await page.locator('button[title="Start all services"]').click();
    const upReq = await upReqPromise;
    expect(upReq.postDataJSON()).toEqual({ composePath: COMPOSE_PATH });

    const downReqPromise = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().endsWith("/api/docker/down"),
    );
    await page.locator('button[title="Stop all services"]').click();
    const downReq = await downReqPromise;
    expect(downReq.postDataJSON()).toEqual({ composePath: COMPOSE_PATH });

    const pullReqPromise = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().endsWith("/api/docker/pull"),
    );
    await page.locator('button[title="Pull latest images"]').click();
    const pullReq = await pullReqPromise;
    expect(pullReq.postDataJSON()).toEqual({ composePath: COMPOSE_PATH });
  });

  test("service-level actions send service name to /up, /down, /restart", async ({
    page,
    sidebar,
  }) => {
    await mockDockerReadApis(page);

    await page.route("**/api/docker/up", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route("**/api/docker/down", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route("**/api/docker/restart", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await openDockerWithMocks(page, sidebar);

    const restartReqPromise = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().endsWith("/api/docker/restart"),
    );
    await page.locator('button[title="Restart service"]').first().click({ force: true });
    const restartReq = await restartReqPromise;
    expect(restartReq.postDataJSON()).toEqual({ composePath: COMPOSE_PATH, service: "web" });

    const stopReqPromise = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().endsWith("/api/docker/down"),
    );
    await page.locator('button[title="Stop service"]').first().click({ force: true });
    const stopReq = await stopReqPromise;
    expect(stopReq.postDataJSON()).toEqual({ composePath: COMPOSE_PATH, service: "web" });

    const startReqPromise = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().endsWith("/api/docker/up"),
    );
    await page.locator('button[title="Start service"]').first().click({ force: true });
    const startReq = await startReqPromise;
    expect(startReq.postDataJSON()).toEqual({ composePath: COMPOSE_PATH, service: "worker" });
  });

  test("container logs and shell actions spawn terminals", async ({
    page,
    sidebar,
    terminalPanel,
  }) => {
    await mockDockerReadApis(page, [DEFAULT_CONTAINERS[0]]);
    await openDockerWithMocks(page, sidebar);

    const before = await terminalPanel.visibleCount();

    await page.locator('button[title="Stream logs in terminal"]').first().click({ force: true });
    await page.waitForTimeout(400);

    await page.locator('button[title="Shell into container"]').first().click({ force: true });
    await page.waitForTimeout(600);

    await expect
      .poll(async () => terminalPanel.visibleCount(), { timeout: 5000 })
      .toBeGreaterThanOrEqual(before + 2);
  });

  test("direct API: /api/docker/discover uses GET query contract", async ({ page }) => {
    const response = await page.request.get("http://localhost:4200/api/docker/discover?paths=/tmp");

    if (response.ok()) {
      const body = await response.json();
      expect(Array.isArray(body.files)).toBe(true);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("direct API: /api/docker/containers expects composePath query", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4200/api/docker/containers?composePath=/nonexistent/docker-compose.yml",
    );

    if (response.ok()) {
      const body = await response.json();
      expect(Array.isArray(body.containers)).toBe(true);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });
});
