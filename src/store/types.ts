export type Provider = "claude" | "codex" | "opencode" | "gemini";

export interface TerminalInstance {
  id: string;
  cwd: string;
  title: string;
  wsConnected: boolean;
  stashed: boolean;
  panelSize: number; // flex ratio for tiling layout (default 1)
  workspaceId: string; // workspace this terminal belongs to (required — no orphans)
  sessionId?: string; // provider session ID when opened from a session card
  customTitle?: string; // user-set name (overrides derived title)
  sessionTitle?: string; // session title shown in sidebar (from SessionCard click)
  lastOutputAt?: number; // Date.now() of last PTY data received
  lastSeenAt?: number; // Date.now() when user last viewed this terminal
  muted?: boolean; // per-terminal mute — skips idle detection entirely
  provider?: Provider; // which AI provider spawned this terminal
  createdAt: number; // Date.now() when terminal was spawned
  firstOutputAt?: number; // Date.now() when first real (post-replay) output arrived — warmup starts here
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
  provider: Provider;
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
  bellMuted: boolean; // global mute — suppresses all notifications across all terminals
  activeProvider: Provider;
  sidebarCollapsed: { workspaces: boolean; sessions: boolean; docker: boolean };
}
