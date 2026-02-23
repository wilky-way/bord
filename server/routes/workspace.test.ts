import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Create real directories for the existsSync/statSync checks
const testDir1 = join(tmpdir(), "bord-ws-test-1-" + Date.now());
const testDir2 = join(tmpdir(), "bord-ws-test-2-" + Date.now());
mkdirSync(testDir1, { recursive: true });
mkdirSync(testDir2, { recursive: true });

let testDb: Database;

mock.module("../services/db", () => ({
  getDb: () => testDb,
  initDb: () => testDb,
}));

const { workspaceRoutes } = await import("./workspace");

function makeReq(method: string, urlStr: string, body?: unknown): [Request, URL] {
  const url = new URL(urlStr, "http://localhost");
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return [new Request(url.toString(), init), url];
}

beforeEach(() => {
  testDb = new Database(":memory:");
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
});

afterAll(() => {
  rmSync(testDir1, { recursive: true, force: true });
  rmSync(testDir2, { recursive: true, force: true });
});

describe("workspaceRoutes", () => {
  test("GET /api/workspaces returns empty list", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/workspaces");
    const res = await workspaceRoutes(req, url);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body).toEqual([]);
  });

  test("POST /api/workspaces creates workspace", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/workspaces", {
      name: "test",
      path: testDir1,
    });
    const res = await workspaceRoutes(req, url);
    expect(res!.status).toBe(201);
    const body = await res!.json();
    expect(body.name).toBe("test");
    expect(body.path).toBe(testDir1);
    expect(body.id).toBeTruthy();
  });

  test("POST /api/workspaces returns 400 for invalid path", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/workspaces", {
      name: "test",
      path: "/nonexistent-bord-test-xyz",
    });
    const res = await workspaceRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/workspaces returns 400 for missing path", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/workspaces", {
      name: "test",
    });
    const res = await workspaceRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("DELETE /api/workspaces/:id deletes workspace", async () => {
    testDb.run("INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)", [
      "test-id",
      "test",
      testDir1,
    ]);

    const [req, url] = makeReq("DELETE", "http://localhost/api/workspaces/test-id");
    const res = await workspaceRoutes(req, url);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.ok).toBe(true);
  });

  test("DELETE /api/workspaces/:id returns 404 for nonexistent", async () => {
    const [req, url] = makeReq("DELETE", "http://localhost/api/workspaces/nonexistent");
    const res = await workspaceRoutes(req, url);
    expect(res!.status).toBe(404);
  });

  test("returns null for unknown paths", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/unknown");
    const res = await workspaceRoutes(req, url);
    expect(res).toBeNull();
  });

  test("GET /api/workspaces returns created workspaces", async () => {
    testDb.run("INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)", [
      "id1",
      "project1",
      testDir1,
    ]);
    testDb.run("INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)", [
      "id2",
      "project2",
      testDir2,
    ]);

    const [req, url] = makeReq("GET", "http://localhost/api/workspaces");
    const res = await workspaceRoutes(req, url);
    const body = await res!.json();
    expect(body).toHaveLength(2);
  });
});
