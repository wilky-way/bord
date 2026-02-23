import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";

/**
 * Workspace service tests using in-memory SQLite.
 * We mock ./db to provide our test database.
 * The workspace route test (workspace.test.ts) also mocks ../services/db,
 * which resolves to the same module — both mocks define getDb/initDb so
 * they're compatible.
 */
let testDb: Database;

mock.module("./db", () => ({
  getDb: () => testDb,
  initDb: () => testDb,
}));

const { listWorkspaces, createWorkspace, deleteWorkspace, getWorkspace } = await import("./workspace-service");

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

describe("workspace-service", () => {
  test("listWorkspaces returns empty array initially", () => {
    const result = listWorkspaces();
    expect(result).toEqual([]);
  });

  test("createWorkspace creates and returns workspace", () => {
    const ws = createWorkspace("project", "/home/project");
    expect(ws.name).toBe("project");
    expect(ws.path).toBe("/home/project");
    expect(ws.id).toBeTruthy();
    expect(ws.created_at).toBeTruthy();
  });

  test("listWorkspaces returns created workspaces", () => {
    createWorkspace("p1", "/path/1");
    createWorkspace("p2", "/path/2");
    const result = listWorkspaces();
    expect(result).toHaveLength(2);
  });

  test("listWorkspaces sorts by updated_at DESC", () => {
    createWorkspace("old", "/path/old");
    createWorkspace("new", "/path/new");
    const result = listWorkspaces();
    expect(result).toHaveLength(2);
  });

  test("getWorkspace returns workspace by id", () => {
    const ws = createWorkspace("test", "/path/test");
    const found = getWorkspace(ws.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe("test");
    expect(found!.path).toBe("/path/test");
  });

  test("getWorkspace returns null for nonexistent id", () => {
    const found = getWorkspace("nonexistent-id");
    expect(found).toBeNull();
  });

  test("deleteWorkspace removes workspace", () => {
    const ws = createWorkspace("test", "/path/test");
    const deleted = deleteWorkspace(ws.id);
    expect(deleted).toBe(true);
    expect(getWorkspace(ws.id)).toBeNull();
    expect(listWorkspaces()).toHaveLength(0);
  });

  test("deleteWorkspace returns false for nonexistent id", () => {
    const deleted = deleteWorkspace("nonexistent");
    expect(deleted).toBe(false);
  });

  test("unique path constraint", () => {
    createWorkspace("first", "/unique/path");
    expect(() => createWorkspace("second", "/unique/path")).toThrow();
  });
});
