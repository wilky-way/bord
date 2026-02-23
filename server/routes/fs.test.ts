import { describe, test, expect, afterAll } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fsRoutes } from "./fs";

const testDir = join(tmpdir(), "bord-fs-test-" + Date.now());

// Create test directory structure
mkdirSync(join(testDir, "projects"), { recursive: true });
mkdirSync(join(testDir, "Documents"), { recursive: true });
mkdirSync(join(testDir, ".hidden"), { recursive: true });

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function makeReq(method: string, urlStr: string): [Request, URL] {
  const url = new URL(urlStr, "http://localhost");
  return [new Request(url.toString(), { method }), url];
}

describe("fsRoutes", () => {
  test("GET /api/fs/browse returns directory listing", async () => {
    const [req, url] = makeReq("GET", `http://localhost/api/fs/browse?path=${testDir}`);
    const res = await fsRoutes(req, url);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.current).toBe(testDir);
    expect(body.parent).toBeTruthy();
    // Should filter out hidden directories
    const names = body.dirs.map((d: { name: string }) => d.name);
    expect(names).toContain("projects");
    expect(names).toContain("Documents");
    expect(names).not.toContain(".hidden");
  });

  test("GET /api/fs/browse returns 400 for nonexistent path", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/fs/browse?path=/nonexistent-bord-test-path-xyz");
    const res = await fsRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("GET /api/fs/browse uses homedir when no path provided", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/fs/browse");
    const res = await fsRoutes(req, url);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.current).toBeTruthy();
  });

  test("GET /api/fs/browse returns null parent for root", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/fs/browse?path=/");
    const res = await fsRoutes(req, url);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.parent).toBeNull();
  });

  test("returns null for unknown paths", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/unknown");
    const res = await fsRoutes(req, url);
    expect(res).toBeNull();
  });
});
