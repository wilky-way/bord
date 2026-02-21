import type { Provider } from "../store/types";

const BASE_URL = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `API error: ${res.status}`;
    try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  // PTY
  createPty: (cwd?: string, command?: string[]) =>
    request<{ id: string; cwd: string }>("/pty", {
      method: "POST",
      body: JSON.stringify({ cwd, command }),
    }),
  listPty: () => request<Array<{ id: string; cwd: string }>>("/pty"),
  destroyPty: (id: string) => request<{ ok: boolean }>(`/pty/${id}`, { method: "DELETE" }),

  // Workspaces
  listWorkspaces: () => request<Array<{ id: string; name: string; path: string }>>("/workspaces"),
  createWorkspace: (name: string, path: string) =>
    request<{ id: string }>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name, path }),
    }),
  deleteWorkspace: (id: string) => request<{ ok: boolean }>(`/workspaces/${id}`, { method: "DELETE" }),

  // Sessions
  listSessions: (project?: string, provider?: string) => {
    const params = new URLSearchParams();
    if (project) params.set("project", project);
    if (provider) params.set("provider", provider);
    const qs = params.toString();
    return request<Array<{
      id: string;
      title: string;
      projectPath: string;
      startedAt: string;
      updatedAt: string;
      messageCount: number;
      provider: Provider;
    }>>(`/sessions${qs ? `?${qs}` : ""}`);
  },

  // Git
  gitStatus: (cwd: string) =>
    request<{
      branch: string;
      staged: Array<{ path: string; status: string }>;
      unstaged: Array<{ path: string; status: string }>;
      untracked: string[];
    }>(`/git/status?cwd=${encodeURIComponent(cwd)}`),
  gitDiff: (cwd: string, opts?: { staged?: boolean; file?: string }) => {
    const params = new URLSearchParams({ cwd });
    if (opts?.staged) params.set("staged", "true");
    if (opts?.file) params.set("file", opts.file);
    return request<{ diff: string }>(`/git/diff?${params}`);
  },
  gitStage: (cwd: string, file: string) =>
    request<{ ok: boolean }>(`/git/stage?cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
      body: JSON.stringify({ file }),
    }),
  gitUnstage: (cwd: string, file: string) =>
    request<{ ok: boolean }>(`/git/unstage?cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
      body: JSON.stringify({ file }),
    }),
  gitCommit: (cwd: string, message: string) =>
    request<{ ok: boolean; error?: string }>(`/git/commit?cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  gitLog: (cwd: string, count?: number) => {
    const params = new URLSearchParams({ cwd });
    if (count) params.set("count", String(count));
    return request<{ log: string }>(`/git/log?${params}`);
  },
  gitAheadBehind: (cwd: string) =>
    request<{ ahead: number; behind: number }>(`/git/ahead-behind?cwd=${encodeURIComponent(cwd)}`),
  gitFetch: (cwd: string) =>
    request<{ ok: boolean; error?: string }>(`/git/fetch?cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
    }),
  gitPush: (cwd: string) =>
    request<{ ok: boolean; error?: string }>(`/git/push?cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
    }),
  gitPull: (cwd: string) =>
    request<{ ok: boolean; error?: string }>(`/git/pull?cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
    }),
  gitBranches: (cwd: string) =>
    request<{ branches: string[] }>(`/git/branches?cwd=${encodeURIComponent(cwd)}`),
  gitCheckout: (cwd: string, branch: string) =>
    request<{ ok: boolean; error?: string }>(`/git/checkout?cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
      body: JSON.stringify({ branch }),
    }),
  gitStageAll: (cwd: string) =>
    request<{ ok: boolean }>(`/git/stage-all?cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
    }),
  gitUnstageAll: (cwd: string) =>
    request<{ ok: boolean }>(`/git/unstage-all?cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
    }),
  gitDiffStats: (cwd: string) =>
    request<{ insertions: number; deletions: number }>(`/git/diff-stats?cwd=${encodeURIComponent(cwd)}`),
  gitDiffStatsPerFile: (cwd: string) =>
    request<{
      staged: Record<string, { insertions: number; deletions: number }>;
      unstaged: Record<string, { insertions: number; deletions: number }>;
    }>(`/git/diff-stats-per-file?cwd=${encodeURIComponent(cwd)}`),
  gitRepoTree: (cwd: string) =>
    request<{
      current: { path: string; name: string; branch: string };
      parent: { path: string; name: string; branch: string } | null;
      siblings: Array<{ path: string; name: string; branch: string }>;
      children: Array<{ path: string; name: string; branch: string }>;
    }>(`/git/repo-tree?cwd=${encodeURIComponent(cwd)}`),

  // Editor
  openInEditor: (cwd: string, editor: "vscode" | "cursor", file?: string) =>
    request<{ ok: boolean; error?: string }>("/editor/open", {
      method: "POST",
      body: JSON.stringify({ cwd, editor, ...(file && { file }) }),
    }),

  // Docker
  dockerDiscover: (paths: string[]) =>
    request<{ files: Array<{ path: string; dir: string; name: string }> }>(
      `/docker/discover?paths=${encodeURIComponent(paths.join(","))}`
    ),
  dockerContainers: (composePath: string) =>
    request<{ containers: Array<{ id: string; name: string; service: string; state: string; status: string }> }>(
      `/docker/containers?composePath=${encodeURIComponent(composePath)}`
    ),
  dockerUp: (composePath: string, service?: string) =>
    request<{ ok: boolean; error?: string }>("/docker/up", {
      method: "POST",
      body: JSON.stringify({ composePath, service }),
    }),
  dockerDown: (composePath: string, service?: string) =>
    request<{ ok: boolean; error?: string }>("/docker/down", {
      method: "POST",
      body: JSON.stringify({ composePath, service }),
    }),
  dockerRestart: (composePath: string, service?: string) =>
    request<{ ok: boolean; error?: string }>("/docker/restart", {
      method: "POST",
      body: JSON.stringify({ composePath, service }),
    }),
  dockerPull: (composePath: string, service?: string) =>
    request<{ ok: boolean; error?: string }>("/docker/pull", {
      method: "POST",
      body: JSON.stringify({ composePath, service }),
    }),
  dockerLogs: (containerId: string, tail = 50) =>
    request<{ logs: string }>(
      `/docker/logs?containerId=${encodeURIComponent(containerId)}&tail=${tail}`
    ),

  // Filesystem
  browseDir: (path?: string) => {
    const params = path ? `?path=${encodeURIComponent(path)}` : "";
    return request<{
      current: string;
      parent: string | null;
      dirs: Array<{ name: string; path: string }>;
    }>(`/fs/browse${params}`);
  },
};
