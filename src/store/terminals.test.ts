import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createRoot } from "solid-js";

// ---- Mocks ----

// Mock api module
const mockCreatePty = mock(() =>
  Promise.resolve({ id: "pty-1", cwd: "/home/user/project" })
);
const mockDestroyPty = mock(() => Promise.resolve({ ok: true }));

mock.module("../lib/api", () => ({
  api: {
    createPty: mockCreatePty,
    destroyPty: mockDestroyPty,
  },
}));

// Mock notifications
const mockMarkViewed = mock(() => {});
const mockClearForTerminal = mock(() => {});

mock.module("../lib/notifications/store", () => ({
  markViewed: mockMarkViewed,
  clearForTerminal: mockClearForTerminal,
}));

// Mock providers
mock.module("../lib/providers", () => ({
  getProviderFromCommand: (cmd?: string[]) => {
    if (!cmd?.[0]) return undefined;
    if (cmd[0].includes("claude")) return "claude";
    if (cmd[0].includes("codex")) return "codex";
    return undefined;
  },
  getResumeSessionId: (cmd?: string[]) => {
    if (!cmd?.length) return undefined;
    const idx = cmd.indexOf("--resume");
    if (idx !== -1 && cmd[idx + 1]) return cmd[idx + 1];
    return undefined;
  },
}));

// Import store after mocks are set up
import { state, setState } from "./core";
import {
  addTerminal,
  removeTerminal,
  stashTerminal,
  unstashTerminal,
  activateAdjacentTerminal,
  moveTerminal,
  getVisibleTerminals,
  setActiveTerminal,
  setTerminalOscTitle,
} from "./terminals";
import type { TerminalInstance, Workspace } from "./types";

// ---- Helpers ----

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

function seedWorkspace() {
  setState("workspaces", [
    { id: "ws-1", name: "Workspace 1", path: "/home/user/project" } as Workspace,
  ]);
  setState("activeWorkspaceId", "ws-1");
}

// ---- Tests ----

describe("stripLeadingEmoji (via setTerminalOscTitle)", () => {
  beforeEach(() => {
    resetStore();
    setState("terminals", [makeTerminal({ id: "t-1", title: "old" })]);
  });

  test("strips basic emoji prefix", () => {
    createRoot((dispose) => {
      setTerminalOscTitle("t-1", "✳️ Claude Code");
      expect(state.terminals[0].title).toBe("Claude Code");
      dispose();
    });
  });

  test("strips compound ZWJ sequence", () => {
    createRoot((dispose) => {
      setTerminalOscTitle("t-1", "👨‍💻 Working");
      expect(state.terminals[0].title).toBe("Working");
      dispose();
    });
  });

  test("passes through title with no leading emoji", () => {
    createRoot((dispose) => {
      setTerminalOscTitle("t-1", "My Terminal");
      expect(state.terminals[0].title).toBe("My Terminal");
      dispose();
    });
  });

  test("handles empty string (falls back to original)", () => {
    createRoot((dispose) => {
      setTerminalOscTitle("t-1", "");
      // stripLeadingEmoji returns original on empty result
      expect(state.terminals[0].title).toBe("");
      dispose();
    });
  });

  test("handles emoji-only string (returns original)", () => {
    createRoot((dispose) => {
      setTerminalOscTitle("t-1", "🔥");
      // When stripped result is empty, falls back to original
      expect(state.terminals[0].title).toBe("🔥");
      dispose();
    });
  });
});

describe("setTerminalOscTitle", () => {
  beforeEach(() => {
    resetStore();
    setState("terminals", [
      makeTerminal({ id: "t-1", title: "old", sessionTitle: "Session Label" }),
      makeTerminal({ id: "t-2", title: "other" }),
    ]);
  });

  test("sets title on correct terminal", () => {
    createRoot((dispose) => {
      setTerminalOscTitle("t-1", "New Title");
      expect(state.terminals[0].title).toBe("New Title");
      expect(state.terminals[1].title).toBe("other");
      dispose();
    });
  });

  test("clears sessionTitle", () => {
    createRoot((dispose) => {
      setTerminalOscTitle("t-1", "New Title");
      expect(state.terminals[0].sessionTitle).toBeUndefined();
      dispose();
    });
  });
});

describe("addTerminal", () => {
  beforeEach(() => {
    resetStore();
    mockCreatePty.mockClear();
  });

  test("returns null when no active workspace", async () => {
    const result = await addTerminal();
    expect(result).toBeNull();
    expect(mockCreatePty).not.toHaveBeenCalled();
  });

  test("creates PTY via api and adds terminal to store", async () => {
    seedWorkspace();
    const id = await addTerminal();
    expect(id).toBe("pty-1");
    expect(mockCreatePty).toHaveBeenCalledTimes(1);
    expect(state.terminals.length).toBe(1);
    expect(state.terminals[0].id).toBe("pty-1");
  });

  test("sets correct cwd from workspace path", async () => {
    seedWorkspace();
    await addTerminal();
    expect(mockCreatePty).toHaveBeenCalledWith(
      "/home/user/project",
      undefined,
      "ws-1"
    );
  });

  test("uses explicit cwd when provided", async () => {
    seedWorkspace();
    await addTerminal("/custom/path");
    expect(mockCreatePty).toHaveBeenCalledWith(
      "/custom/path",
      undefined,
      "ws-1"
    );
  });

  test("extracts provider from command", async () => {
    seedWorkspace();
    await addTerminal(undefined, ["claude", "--resume", "abc"]);
    expect(state.terminals[0].provider).toBe("claude");
  });

  test("extracts sessionId from --resume flag", async () => {
    seedWorkspace();
    await addTerminal(undefined, ["claude", "--resume", "session-123"]);
    expect(state.terminals[0].sessionId).toBe("session-123");
  });

  test("sets terminal as active", async () => {
    seedWorkspace();
    const id = await addTerminal();
    expect(state.activeTerminalId).toBe(id);
  });

  test("sets sessionTitle when provided", async () => {
    seedWorkspace();
    await addTerminal(undefined, undefined, "My Session");
    expect(state.terminals[0].sessionTitle).toBe("My Session");
  });
});

describe("removeTerminal", () => {
  beforeEach(() => {
    resetStore();
    mockDestroyPty.mockClear();
    mockClearForTerminal.mockClear();
  });

  test("calls destroyPty", async () => {
    setState("terminals", [makeTerminal({ id: "t-1" })]);
    setState("activeTerminalId", "t-1");
    await removeTerminal("t-1");
    expect(mockDestroyPty).toHaveBeenCalledWith("t-1");
  });

  test("cleans up notifications", async () => {
    setState("terminals", [makeTerminal({ id: "t-1" })]);
    setState("activeTerminalId", "t-1");
    await removeTerminal("t-1");
    expect(mockClearForTerminal).toHaveBeenCalledWith("t-1");
  });

  test("removes terminal from store", async () => {
    setState("terminals", [
      makeTerminal({ id: "t-1" }),
      makeTerminal({ id: "t-2" }),
    ]);
    setState("activeTerminalId", "t-1");
    await removeTerminal("t-1");
    expect(state.terminals.length).toBe(1);
    expect(state.terminals[0].id).toBe("t-2");
  });

  test("falls back active terminal when removing active", async () => {
    seedWorkspace();
    setState("terminals", [
      makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
      makeTerminal({ id: "t-2", workspaceId: "ws-1" }),
    ]);
    setState("activeTerminalId", "t-1");
    await removeTerminal("t-1");
    expect(state.activeTerminalId).toBe("t-2");
  });

  test("sets activeTerminalId to null when last terminal removed", async () => {
    setState("terminals", [makeTerminal({ id: "t-1" })]);
    setState("activeTerminalId", "t-1");
    await removeTerminal("t-1");
    expect(state.activeTerminalId).toBeNull();
  });

  test("does not change activeTerminalId when removing non-active", async () => {
    setState("terminals", [
      makeTerminal({ id: "t-1" }),
      makeTerminal({ id: "t-2" }),
    ]);
    setState("activeTerminalId", "t-2");
    await removeTerminal("t-1");
    expect(state.activeTerminalId).toBe("t-2");
  });
});

describe("stashTerminal", () => {
  beforeEach(() => {
    resetStore();
    seedWorkspace();
  });

  test("sets stashed flag", () => {
    createRoot((dispose) => {
      setState("terminals", [makeTerminal({ id: "t-1" })]);
      stashTerminal("t-1");
      expect(state.terminals[0].stashed).toBe(true);
      dispose();
    });
  });

  test("switches active terminal away when stashing active", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-2", workspaceId: "ws-1" }),
      ]);
      setState("activeTerminalId", "t-1");
      stashTerminal("t-1");
      expect(state.activeTerminalId).toBe("t-2");
      dispose();
    });
  });

  test("sets activeTerminalId to null when stashing only terminal", () => {
    createRoot((dispose) => {
      setState("terminals", [makeTerminal({ id: "t-1" })]);
      setState("activeTerminalId", "t-1");
      stashTerminal("t-1");
      expect(state.activeTerminalId).toBeNull();
      dispose();
    });
  });

  test("does not change activeTerminalId when stashing non-active", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1" }),
        makeTerminal({ id: "t-2" }),
      ]);
      setState("activeTerminalId", "t-2");
      stashTerminal("t-1");
      expect(state.activeTerminalId).toBe("t-2");
      dispose();
    });
  });
});

describe("unstashTerminal", () => {
  beforeEach(() => {
    resetStore();
    mockMarkViewed.mockClear();
  });

  test("clears stashed flag", () => {
    createRoot((dispose) => {
      setState("terminals", [makeTerminal({ id: "t-1", stashed: true })]);
      unstashTerminal("t-1");
      expect(state.terminals[0].stashed).toBe(false);
      dispose();
    });
  });

  test("calls markViewed", () => {
    createRoot((dispose) => {
      setState("terminals", [makeTerminal({ id: "t-1", stashed: true })]);
      unstashTerminal("t-1");
      expect(mockMarkViewed).toHaveBeenCalledWith("t-1");
      dispose();
    });
  });

  test("sets as active terminal", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1" }),
        makeTerminal({ id: "t-2", stashed: true }),
      ]);
      setState("activeTerminalId", "t-1");
      unstashTerminal("t-2");
      expect(state.activeTerminalId).toBe("t-2");
      dispose();
    });
  });
});

describe("activateAdjacentTerminal", () => {
  beforeEach(() => {
    resetStore();
    seedWorkspace();
    mockMarkViewed.mockClear();
  });

  test("moves to next terminal", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-2", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-3", workspaceId: "ws-1" }),
      ]);
      setState("activeTerminalId", "t-1");
      activateAdjacentTerminal("next");
      expect(state.activeTerminalId).toBe("t-2");
      dispose();
    });
  });

  test("moves to previous terminal", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-2", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-3", workspaceId: "ws-1" }),
      ]);
      setState("activeTerminalId", "t-2");
      activateAdjacentTerminal("prev");
      expect(state.activeTerminalId).toBe("t-1");
      dispose();
    });
  });

  test("wraps around forward", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-2", workspaceId: "ws-1" }),
      ]);
      setState("activeTerminalId", "t-2");
      activateAdjacentTerminal("next");
      expect(state.activeTerminalId).toBe("t-1");
      dispose();
    });
  });

  test("wraps around backward", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-2", workspaceId: "ws-1" }),
      ]);
      setState("activeTerminalId", "t-1");
      activateAdjacentTerminal("prev");
      expect(state.activeTerminalId).toBe("t-2");
      dispose();
    });
  });

  test("no-op with single terminal", () => {
    createRoot((dispose) => {
      setState("terminals", [makeTerminal({ id: "t-1", workspaceId: "ws-1" })]);
      setState("activeTerminalId", "t-1");
      activateAdjacentTerminal("next");
      expect(state.activeTerminalId).toBe("t-1");
      dispose();
    });
  });

  test("no-op with no terminals", () => {
    createRoot((dispose) => {
      activateAdjacentTerminal("next");
      expect(state.activeTerminalId).toBeNull();
      dispose();
    });
  });
});

describe("moveTerminal", () => {
  beforeEach(() => {
    resetStore();
  });

  test("moves terminal forward", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1" }),
        makeTerminal({ id: "t-2" }),
        makeTerminal({ id: "t-3" }),
      ]);
      moveTerminal(0, 2);
      expect(state.terminals.map((t) => t.id)).toEqual(["t-2", "t-3", "t-1"]);
      dispose();
    });
  });

  test("moves terminal backward", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1" }),
        makeTerminal({ id: "t-2" }),
        makeTerminal({ id: "t-3" }),
      ]);
      moveTerminal(2, 0);
      expect(state.terminals.map((t) => t.id)).toEqual(["t-3", "t-1", "t-2"]);
      dispose();
    });
  });

  test("same-index is no-op", () => {
    createRoot((dispose) => {
      setState("terminals", [
        makeTerminal({ id: "t-1" }),
        makeTerminal({ id: "t-2" }),
      ]);
      moveTerminal(1, 1);
      expect(state.terminals.map((t) => t.id)).toEqual(["t-1", "t-2"]);
      dispose();
    });
  });
});

describe("getVisibleTerminals", () => {
  beforeEach(() => {
    resetStore();
  });

  test("filters by active workspace", () => {
    createRoot((dispose) => {
      setState("activeWorkspaceId", "ws-1");
      setState("terminals", [
        makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-2", workspaceId: "ws-2" }),
        makeTerminal({ id: "t-3", workspaceId: "ws-1" }),
      ]);
      const visible = getVisibleTerminals();
      expect(visible.map((t) => t.id)).toEqual(["t-1", "t-3"]);
      dispose();
    });
  });

  test("excludes stashed terminals", () => {
    createRoot((dispose) => {
      setState("activeWorkspaceId", "ws-1");
      setState("terminals", [
        makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-2", workspaceId: "ws-1", stashed: true }),
      ]);
      const visible = getVisibleTerminals();
      expect(visible.map((t) => t.id)).toEqual(["t-1"]);
      dispose();
    });
  });

  test("returns all non-stashed when no active workspace", () => {
    createRoot((dispose) => {
      setState("activeWorkspaceId", null);
      setState("terminals", [
        makeTerminal({ id: "t-1", workspaceId: "ws-1" }),
        makeTerminal({ id: "t-2", workspaceId: "ws-2", stashed: true }),
        makeTerminal({ id: "t-3", workspaceId: "ws-2" }),
      ]);
      const visible = getVisibleTerminals();
      expect(visible.map((t) => t.id)).toEqual(["t-1", "t-3"]);
      dispose();
    });
  });
});

describe("setActiveTerminal", () => {
  beforeEach(() => {
    resetStore();
    mockMarkViewed.mockClear();
  });

  test("sets activeTerminalId in store", () => {
    createRoot((dispose) => {
      setState("terminals", [makeTerminal({ id: "t-1" })]);
      setActiveTerminal("t-1");
      expect(state.activeTerminalId).toBe("t-1");
      dispose();
    });
  });

  test("calls markViewed", () => {
    createRoot((dispose) => {
      setState("terminals", [makeTerminal({ id: "t-1" })]);
      setActiveTerminal("t-1");
      expect(mockMarkViewed).toHaveBeenCalledWith("t-1");
      dispose();
    });
  });
});
