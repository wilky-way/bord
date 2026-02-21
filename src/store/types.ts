export interface TerminalInstance {
  id: string;
  cwd: string;
  title: string;
  wsConnected: boolean;
  stashed: boolean;
  panelSize: number; // flex ratio for tiling layout (default 1)
  workspaceId?: string; // workspace this terminal belongs to
  sessionId?: string; // Claude session ID when resuming via --resume
  customTitle?: string; // user-set name (overrides derived title)
  sessionTitle?: string; // Claude session summary (from SessionCard click)
  lastOutputAt?: number; // Date.now() of last PTY data received
  lastSeenAt?: number; // Date.now() when user last viewed this terminal
  needsAttention?: boolean; // notification flag — set when idle, cleared on focus
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
}

export interface SessionInfo {
  id: string;
  title: string;
  projectPath: string;
  startedAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface GitStatus {
  branch: string;
  staged: { path: string; status: string }[];
  unstaged: { path: string; status: string }[];
  untracked: string[];
}

export interface AppState {
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  sidebarOpen: boolean;
  layoutColumns: number; // 0 = auto-fit all visible, 1–4 = fixed columns visible at once
  gitPanelTerminalId: string | null; // which terminal's git overlay is open (null = none)
}
