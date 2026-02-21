import { createStore } from "solid-js/store";
import type { AppState } from "./types";

const [state, setState] = createStore<AppState>({
  terminals: [],
  activeTerminalId: null,
  workspaces: [],
  activeWorkspaceId: null,
  sidebarOpen: true,
  layoutColumns: 0,
});

export { state, setState };
