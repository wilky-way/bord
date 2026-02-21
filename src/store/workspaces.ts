import { setState } from "./core";
import { api } from "../lib/api";
import type { Workspace } from "./types";

export async function loadWorkspaces() {
  const workspaces = await api.listWorkspaces();
  setState("workspaces", workspaces as Workspace[]);
}

export async function createWorkspace(name: string, path: string) {
  const result = await api.createWorkspace(name, path);
  setState("workspaces", (prev) => [
    { id: result.id, name, path } as Workspace,
    ...prev,
  ]);
  return result.id;
}

export async function deleteWorkspace(id: string) {
  await api.deleteWorkspace(id);
  setState("workspaces", (prev) => prev.filter((w) => w.id !== id));
}

export function setActiveWorkspace(id: string | null) {
  setState("activeWorkspaceId", id);
}
