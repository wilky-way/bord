import { describe, test, expect } from "bun:test";

/**
 * Git route tests focused on input validation.
 * These tests import the actual route module but only exercise code paths
 * that return before calling into git-service (missing params, validation errors).
 * This avoids mock.module conflicts with git-service.test.ts.
 */
import { gitRoutes } from "./git";

function makeReq(method: string, urlStr: string, body?: unknown): [Request, URL] {
  const url = new URL(urlStr, "http://localhost");
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return [new Request(url.toString(), init), url];
}

describe("gitRoutes input validation", () => {
  test("returns 400 when cwd is missing", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/git/status");
    const res = await gitRoutes(req, url);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("cwd");
  });

  test("returns 400 when cwd path does not exist", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/git/status?cwd=/nonexistent-bord-xyz-test");
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/git/stage requires file", async () => {
    // Use a real directory so validateCwd passes, then check file validation
    const [req, url] = makeReq("POST", "http://localhost/api/git/stage?cwd=/tmp", {});
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("file");
  });

  test("POST /api/git/stage rejects path traversal", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/git/stage?cwd=/tmp", {
      file: "../../etc/passwd",
    });
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("escapes");
  });

  test("POST /api/git/unstage requires file", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/git/unstage?cwd=/tmp", {});
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/git/unstage rejects path traversal", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/git/unstage?cwd=/tmp", {
      file: "../../etc/passwd",
    });
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/git/commit requires message", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/git/commit?cwd=/tmp", {});
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("message");
  });

  test("POST /api/git/commit rejects oversized message", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/git/commit?cwd=/tmp", {
      message: "x".repeat(10241),
    });
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("maximum length");
  });

  test("POST /api/git/checkout requires branch", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/git/checkout?cwd=/tmp", {});
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/git/checkout rejects invalid branch name (flag injection)", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/git/checkout?cwd=/tmp", {
      branch: "--force",
    });
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("'-'");
  });

  test("POST /api/git/checkout rejects branch with special chars", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/git/checkout?cwd=/tmp", {
      branch: "foo..bar",
    });
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("GET /api/git/diff rejects file path traversal", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/git/diff?cwd=/tmp&file=../../etc/passwd");
    const res = await gitRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("escapes");
  });

  test("returns null for unknown paths", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/git/unknown?cwd=/tmp");
    const res = await gitRoutes(req, url);
    expect(res).toBeNull();
  });
});
