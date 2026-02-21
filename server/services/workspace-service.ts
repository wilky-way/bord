import { getDb } from "./db";
import { randomUUID } from "crypto";

export interface Workspace {
  id: string;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export function listWorkspaces(): Workspace[] {
  return getDb().query("SELECT * FROM workspaces ORDER BY updated_at DESC").all() as Workspace[];
}

export function createWorkspace(name: string, path: string): Workspace {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb().run(
    "INSERT INTO workspaces (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [id, name, path, now, now]
  );
  return { id, name, path, created_at: now, updated_at: now };
}

export function deleteWorkspace(id: string): boolean {
  const result = getDb().run("DELETE FROM workspaces WHERE id = ?", [id]);
  return result.changes > 0;
}

export function getWorkspace(id: string): Workspace | null {
  return getDb().query("SELECT * FROM workspaces WHERE id = ?").get(id) as Workspace | null;
}
