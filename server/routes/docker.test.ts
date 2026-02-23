import { describe, test, expect } from "bun:test";
import { dockerRoutes } from "./docker";

/**
 * Docker route tests focused on input validation.
 * Tests only code paths that return before calling into docker-service.
 */

function makeReq(method: string, urlStr: string, body?: unknown): [Request, URL] {
  const url = new URL(urlStr, "http://localhost");
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return [new Request(url.toString(), init), url];
}

describe("dockerRoutes input validation", () => {
  test("GET /api/docker/discover requires paths", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/docker/discover");
    const res = await dockerRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("paths");
  });

  test("GET /api/docker/containers requires composePath", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/docker/containers");
    const res = await dockerRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("composePath");
  });

  test("POST /api/docker/up requires composePath", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/docker/up", {});
    const res = await dockerRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/docker/down requires composePath", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/docker/down", {});
    const res = await dockerRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/docker/restart requires composePath", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/docker/restart", {});
    const res = await dockerRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/docker/pull requires composePath", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/docker/pull", {});
    const res = await dockerRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("GET /api/docker/logs requires containerId", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/docker/logs");
    const res = await dockerRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("containerId");
  });

  test("GET /api/docker/logs rejects invalid containerId (command injection)", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/docker/logs?containerId=;rm+-rf+/");
    const res = await dockerRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("invalid characters");
  });

  test("GET /api/docker/logs rejects containerId starting with dash", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/docker/logs?containerId=-flag");
    const res = await dockerRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("returns null for unknown paths", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/docker/unknown");
    const res = await dockerRoutes(req, url);
    expect(res).toBeNull();
  });
});
