import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createRoot } from "solid-js";

// ---- Mocks ----

const mockListWorkspaces = mock(() =>
  Promise.resolve([
    { id: "ws-1", name: "Project A", path: "/home/a" },
    { id: "ws-2", name: "Project B", path: "/home/b" },
  ])
);
const mockCreateWorkspace = mock(() => Promise.resolve({ id: "ws-new" }));
const mockDeleteWorkspace = mock(() => Promise.resolve({ ok: true }));
const mockDestroyPty = mock(() => Promise.resolve({ ok: true }));

mock.module("../lib/api", () => ({
  api: {
    listWorkspaces: mockListWorkspaces,
    createWorkspace: mockCreateWorkspace,
    deleteWorkspace: mockDeleteWorkspace,
    destroyPty: mockDestroyPty,
  },
}));

mock.module("../lib/notifications/store", () => ({
  markViewed: mock(() => {}),
  clearForTerminal: mock(() => {}),
}));

mock.module("../lib/providers", () => ({
  getProviderFromCommand: () => undefined,
  getResumeSessionId: () => undefined,
}));

import { state, setState } from "./core";
import {
  loadWorkspaces,
  createWorkspace,
  deleteWorkspace,
  setActiveWorkspace,
} from "./workspaces";
import type { TerminalInstance, Workspace } from "./types";

function makeTerminal(overrides: Partial<TerminalInstance> = {}): TerminalInstance {
  return {
    id: overrides.id ?? "t-1",
    cwd: "/home/user",
    title: "terminal",
    wsConnected: false,
    stashed: false,
    panelSize: 1,
    workspaceId: "ws-1",
    createdAt: Date.now(),
    ...overrides,
  };
}

function resetStore() {
  setState("terminals", []);
  setState("activeTerminalId", null);
  setState("workspaces", []);
  setState("activeWorkspaceId", null);
  setState("sidebarOpen", true);
  setState("layoutColumns", 0);
  setState("gitPanelTerminalId", null);
  setState("bellMuted", false);
}

describe("loadWorkspaces", () => {
  beforeEach(() => {
    resetStore();
    mockListWorkspaces.mockClear();
  });

  test("populates store on success", async () => {
    await loadWorkspaces();
    expect(state.workspaces.length).toBe(2);
    expect(state.workspaces[0].name).toBe("Project A");
    expect(state.workspaces[1].name).toBe("Project B");
  });

  test("handles error gracefully", async () => {
    mockListWorkspaces.mockImplementationOnce(() =>
      Promise.reject(new Error("Network error"))
    );
    // Should throw since loadWorkspaces doesn't catch internally
    await expect(loadWorkspaces()).rejects.toThrow();
  });
});

describe("createWorkspace", () => {
  beforeEach(() => {
    resetStore();
    mockCreateWorkspace.mockClear();
  });

  test("calls API with name and path", async () => {
    await createWorkspace("My Project", "/home/project");
    expect(mockCreateWorkspace).toHaveBeenCalledWith("My Project", "/home/project");
  });

  test("adds workspace to store", async () => {
    await createWorkspace("My Project", "/home/project");
    expect(state.workspaces.length).toBe(1);
    expect(state.workspaces[0].id).toBe("ws-new");
    expect(state.workspaces[0].name).toBe("My Project");
  });

  test("returns the new workspace id", async () => {
    const id = await createWorkspace("My Project", "/home/project");
    expect(id).toBe("ws-new");
  });

  test("prepends new workspace to list", async () => {
    setState("workspaces", [
      { id: "ws-existing", name: "Old", path: "/old" } as Workspace,
    ]);
    await createWorkspace("New Project", "/new");
    expect(state.workspaces[0].id).toBe("ws-new");
    expect(state.workspaces[1].id).toBe("ws-existing");
  });
});

describe("deleteWorkspace", () => {
  beforeEach(() => {
    resetStore();
    mockDeleteWorkspace.mockClear();
    mockDestroyPty.mockClear();
  });

  test("calls API to delete", async () => {
    setState("workspaces", [
      { id: "ws-1", name: "Project", path: "/project" } as Workspace,
    ]);
    await deleteWorkspace("ws-1");
    expect(mockDeleteWorkspace).toHaveBeenCalledWith("ws-1");
  });

  test("removes workspace from store", async () => {
    setState("workspaces", [
      { id: "ws-1", name: "A", path: "/a" } as Workspace,
      { id: "ws-2", name: "B", path: "/b" } as Workspace,
    ]);
    await deleteWorkspace("ws-1");
    expect(state.workspaces.length).toBe(1);
    expect(state.workspaces[0].id).toBe("ws-2");
  });

  test("cascades terminal removal for workspace terminals", async () => {
    setState("workspaces", [
      { id: "ws-1", name: "A", path: "/a" } as Workspace,
    ]);
    setState("terminals", [
      makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
      makeTerminal({ id: "t-2", workspaceId: "ws-2" }),
      makeTerminal({ id: "t-3", workspaceId: "ws-1" }),
    ]);
    await deleteWorkspace("ws-1");
    // Only t-2 should remain (different workspace)
    expect(state.terminals.length).toBe(1);
    expect(state.terminals[0].id).toBe("t-2");
  });

  test("calls destroyPty for each orphaned terminal", async () => {
    setState("workspaces", [
      { id: "ws-1", name: "A", path: "/a" } as Workspace,
    ]);
    setState("terminals", [
      makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
      makeTerminal({ id: "t-2", workspaceId: "ws-1" }),
    ]);
    await deleteWorkspace("ws-1");
    expect(mockDestroyPty).toHaveBeenCalledTimes(2);
  });
});

describe("setActiveWorkspace", () => {
  beforeEach(() => {
    resetStore();
  });

  test("updates activeWorkspaceId", () => {
    createRoot((dispose) => {
      setActiveWorkspace("ws-1");
      expect(state.activeWorkspaceId).toBe("ws-1");
      dispose();
    });
  });

  test("can set to null", () => {
    createRoot((dispose) => {
      setState("activeWorkspaceId", "ws-1");
      setActiveWorkspace(null);
      expect(state.activeWorkspaceId).toBeNull();
      dispose();
    });
  });
});
