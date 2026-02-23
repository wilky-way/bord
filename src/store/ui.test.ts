import { describe, test, expect, beforeEach } from "bun:test";
import { createRoot } from "solid-js";
import { state, setState } from "./core";
import { toggleSidebar } from "./ui";

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

describe("ui", () => {
  beforeEach(() => {
    resetStore();
  });

  test("initial sidebar state is true", () => {
    createRoot((dispose) => {
      expect(state.sidebarOpen).toBe(true);
      dispose();
    });
  });

  test("toggleSidebar flips from true to false", () => {
    createRoot((dispose) => {
      setState("sidebarOpen", true);
      toggleSidebar();
      expect(state.sidebarOpen).toBe(false);
      dispose();
    });
  });

  test("toggleSidebar flips from false to true", () => {
    createRoot((dispose) => {
      setState("sidebarOpen", false);
      toggleSidebar();
      expect(state.sidebarOpen).toBe(true);
      dispose();
    });
  });
});
