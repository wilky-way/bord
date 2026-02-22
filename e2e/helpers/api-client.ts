/** Direct HTTP client for test setup/teardown — bypasses the UI. */

const BASE = process.env.BORD_SERVER_URL ?? "http://localhost:4200";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const apiClient = {
  health: () => request<{ status: string; uptime: number; timestamp: string }>("/health"),

  // Workspaces
  listWorkspaces: () =>
    request<Array<{ id: string; name: string; path: string }>>("/workspaces"),
  createWorkspace: (name: string, path: string) =>
    request<{ id: string }>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name, path }),
    }),
  deleteWorkspace: (id: string) =>
    request<{ ok: boolean }>(`/workspaces/${id}`, { method: "DELETE" }),

  // PTY
  createPty: (cwd: string) =>
    request<{ id: string; cwd: string }>("/pty", {
      method: "POST",
      body: JSON.stringify({ cwd }),
    }),
  listPty: () => request<Array<{ id: string; cwd: string }>>("/pty"),
  destroyPty: (id: string) =>
    request<{ ok: boolean }>(`/pty/${id}`, { method: "DELETE" }),

  // Git
  gitStatus: (cwd: string) =>
    request<{
      branch: string;
      staged: Array<{ path: string; status: string }>;
      unstaged: Array<{ path: string; status: string }>;
      untracked: string[];
    }>(`/git/status?cwd=${encodeURIComponent(cwd)}`),

  // Sessions
  listSessions: (project?: string, provider?: string) => {
    const params = new URLSearchParams();
    if (project) params.set("project", project);
    if (provider) params.set("provider", provider);
    const qs = params.toString();
    return request<Array<{ id: string; title: string; provider: string }>>(
      `/sessions${qs ? `?${qs}` : ""}`,
    );
  },
};
