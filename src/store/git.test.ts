import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createRoot } from "solid-js";

// ---- Mocks ----

const mockGitStatus = mock(() =>
  Promise.resolve({
    branch: "main",
    staged: [{ path: "file.ts", status: "M" }],
    unstaged: [{ path: "other.ts", status: "M" }],
    untracked: ["new.ts"],
  })
);

mock.module("../lib/api", () => ({
  api: {
    gitStatus: mockGitStatus,
  },
}));

import { state, setState } from "./core";
import {
  refreshGitStatus,
  gitStatus,
  gitLoading,
  toggleGitPanel,
  closeGitPanel,
} from "./git";

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

describe("refreshGitStatus", () => {
  beforeEach(() => {
    resetStore();
    mockGitStatus.mockClear();
  });

  test("populates gitStatus on success", async () => {
    await refreshGitStatus("/project");
    createRoot((dispose) => {
      const status = gitStatus();
      expect(status).not.toBeNull();
      expect(status!.branch).toBe("main");
      expect(status!.staged.length).toBe(1);
      expect(status!.unstaged.length).toBe(1);
      expect(status!.untracked.length).toBe(1);
      dispose();
    });
  });

  test("sets loading state during request", async () => {
    // Check that gitLoading is false after completion
    await refreshGitStatus("/project");
    createRoot((dispose) => {
      expect(gitLoading()).toBe(false);
      dispose();
    });
  });

  test("handles error by setting gitStatus to null", async () => {
    mockGitStatus.mockImplementationOnce(() =>
      Promise.reject(new Error("git not found"))
    );
    await refreshGitStatus("/project");
    createRoot((dispose) => {
      expect(gitStatus()).toBeNull();
      expect(gitLoading()).toBe(false);
      dispose();
    });
  });

  test("clears loading state after error", async () => {
    mockGitStatus.mockImplementationOnce(() =>
      Promise.reject(new Error("fail"))
    );
    await refreshGitStatus("/project");
    createRoot((dispose) => {
      expect(gitLoading()).toBe(false);
      dispose();
    });
  });

  test("passes cwd to api", async () => {
    await refreshGitStatus("/my/repo");
    expect(mockGitStatus).toHaveBeenCalledWith("/my/repo");
  });
});

describe("toggleGitPanel", () => {
  beforeEach(() => {
    resetStore();
  });

  test("opens when closed", () => {
    createRoot((dispose) => {
      toggleGitPanel("t-1");
      expect(state.gitPanelTerminalId).toBe("t-1");
      dispose();
    });
  });

  test("closes when open for same terminal", () => {
    createRoot((dispose) => {
      setState("gitPanelTerminalId", "t-1");
      toggleGitPanel("t-1");
      expect(state.gitPanelTerminalId).toBeNull();
      dispose();
    });
  });

  test("switches to different terminal", () => {
    createRoot((dispose) => {
      setState("gitPanelTerminalId", "t-1");
      toggleGitPanel("t-2");
      expect(state.gitPanelTerminalId).toBe("t-2");
      dispose();
    });
  });

  test("no-op with null terminalId", () => {
    createRoot((dispose) => {
      setState("gitPanelTerminalId", "t-1");
      toggleGitPanel(null);
      // Should not change when null is passed
      expect(state.gitPanelTerminalId).toBe("t-1");
      dispose();
    });
  });
});

describe("closeGitPanel", () => {
  beforeEach(() => {
    resetStore();
  });

  test("sets gitPanelTerminalId to null", () => {
    createRoot((dispose) => {
      setState("gitPanelTerminalId", "t-1");
      closeGitPanel();
      expect(state.gitPanelTerminalId).toBeNull();
      dispose();
    });
  });
});
