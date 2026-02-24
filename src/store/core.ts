import { createStore } from "solid-js/store";
import type { AppState } from "./types";

const [state, setState] = createStore<AppState>({
  terminals: [],
  activeTerminalId: null,
  workspaces: [],
  activeWorkspaceId: null,
  sidebarOpen: true,
  layoutColumns: 0,
  gitPanelTerminalId: null,
  bellMuted: false,
  activeProvider: "claude",
  sidebarCollapsed: { workspaces: false, sessions: false, docker: false },
  sidebarMode: "sessions",
  sidebarWidth: 352,
});

export { state, setState };

// Expose store on window for QA/capture-media scripts
(window as any).__bord = { state, setState };
