import { describe, test, expect } from "bun:test";
import { ptyRoutes } from "./pty";

/**
 * PTY route tests focused on input validation.
 * Tests only the code paths that return before calling into pty-manager
 * to avoid mock.module conflicts.
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

describe("ptyRoutes input validation", () => {
  test("POST /api/pty returns 400 for invalid cwd", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/pty", {
      cwd: "/nonexistent-bord-xyz-test",
    });
    const res = await ptyRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/pty returns 400 for invalid command type", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/pty", {
      cwd: "/tmp",
      command: "not-an-array",
    });
    const res = await ptyRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("command must be string[]");
  });

  test("POST /api/pty returns 400 for command with non-string elements", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/pty", {
      cwd: "/tmp",
      command: [1, 2, 3],
    });
    const res = await ptyRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("returns null for unknown paths", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/unknown");
    const res = await ptyRoutes(req, url);
    expect(res).toBeNull();
  });
});
