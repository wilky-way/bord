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
  sidebarCollapsed: { workspaces: false, sessions: false, docker: false },
});

export { state, setState };
