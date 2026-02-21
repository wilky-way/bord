import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import { state } from "../../store/core";
import { api } from "../../lib/api";
import { addTerminal } from "../../store/terminals";

interface ComposeFile {
  path: string;
  dir: string;
  name: string;
}

interface ContainerInfo {
  id: string;
  name: string;
  service: string;
  state: string;
  status: string;
}

interface ComposeEntry {
  file: ComposeFile;
  containers: ContainerInfo[];
  loading: boolean;
}

export default function DockerPanel() {
  const [entries, setEntries] = createSignal<ComposeEntry[]>([]);
  const [discovering, setDiscovering] = createSignal(false);

  const activeWorkspace = () => state.workspaces.find((w) => w.id === state.activeWorkspaceId);

  async function discover() {
    const ws = activeWorkspace();
    if (!ws) {
      setEntries([]);
      return;
    }
    setDiscovering(true);
    try {
      const result = await api.dockerDiscover([ws.path]);
      setEntries(result.files.map((f) => ({ file: f, containers: [], loading: true })));
      // Fetch containers for each compose file
      await Promise.all(
        result.files.map(async (f, i) => {
          try {
            const res = await api.dockerContainers(f.path);
            setEntries((prev) =>
              prev.map((e, j) => (j === i ? { ...e, containers: res.containers, loading: false } : e))
            );
          } catch {
            setEntries((prev) =>
              prev.map((e, j) => (j === i ? { ...e, loading: false } : e))
            );
          }
        })
      );
    } catch {
      setEntries([]);
    } finally {
      setDiscovering(false);
    }
  }

  async function refreshContainers() {
    const current = entries();
    await Promise.all(
      current.map(async (entry, i) => {
        try {
          const res = await api.dockerContainers(entry.file.path);
          setEntries((prev) =>
            prev.map((e, j) => (j === i ? { ...e, containers: res.containers } : e))
          );
        } catch {
          // keep existing state
        }
      })
    );
  }

  // Discover on mount + when active workspace changes
  createEffect(() => {
    const _wsId = state.activeWorkspaceId; // track dependency
    discover();
  });

  // Auto-refresh container status every 5s
  const interval = setInterval(refreshContainers, 5000);
  onCleanup(() => clearInterval(interval));

  async function handleUp(composePath: string, service?: string) {
    await api.dockerUp(composePath, service);
    refreshContainers();
  }

  async function handleDown(composePath: string, service?: string) {
    await api.dockerDown(composePath, service);
    refreshContainers();
  }

  function openLogs(containerId: string) {
    const ws = activeWorkspace();
    addTerminal(ws?.path, ["docker", "logs", "-f", containerId]);
  }

  function openShell(containerId: string) {
    const ws = activeWorkspace();
    addTerminal(ws?.path, ["docker", "exec", "-it", containerId, "sh"]);
  }

  function stateColor(s: string): string {
    switch (s) {
      case "running":
        return "bg-[var(--success)]";
      case "exited":
      case "dead":
        return "bg-[var(--danger)]";
      case "paused":
        return "bg-[var(--warning)]";
      default:
        return "bg-[var(--text-secondary)]";
    }
  }

  return (
    <div class="p-2 max-h-64 overflow-y-auto">
      <Show when={!activeWorkspace()}>
        <div class="text-xs text-[var(--text-secondary)] py-2 text-center">
          Select a workspace
        </div>
      </Show>

      <Show when={discovering()}>
        <div class="text-xs text-[var(--text-secondary)] py-2 text-center">
          Scanning...
        </div>
      </Show>

      <Show when={activeWorkspace() && !discovering() && entries().length === 0}>
        <div class="text-xs text-[var(--text-secondary)] py-2 text-center">
          No compose files found
        </div>
      </Show>

      <For each={entries()}>
        {(entry) => (
          <div class="mb-2">
            {/* Compose file header */}
            <div class="flex items-center gap-1.5 mb-1">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="1" y="3" width="14" height="10" rx="1.5" />
                <path d="M5 3V1.5h6V3" />
              </svg>
              <span class="text-xs font-medium text-[var(--text-primary)] truncate" title={entry.file.path}>
                {entry.file.name}
              </span>
            </div>

            <Show when={entry.loading}>
              <div class="text-[10px] text-[var(--text-secondary)] pl-4">Loading...</div>
            </Show>

            {/* Service rows */}
            <For each={entry.containers}>
              {(container) => {
                const isRunning = () => container.state === "running";
                return (
                  <div class="flex items-center gap-1.5 pl-4 py-0.5 group">
                    <span class={`w-1.5 h-1.5 rounded-full shrink-0 ${stateColor(container.state)}`} />
                    <span class="text-xs text-[var(--text-primary)] truncate flex-1" title={container.name}>
                      {container.service}
                    </span>
                    <span class="text-[10px] text-[var(--text-secondary)] shrink-0">
                      {container.state}
                    </span>

                    {/* Action buttons */}
                    <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Show when={isRunning()}>
                        <button
                          class="text-[10px] px-1 py-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          onClick={() => openLogs(container.id)}
                          title="Stream logs in terminal"
                        >
                          Logs
                        </button>
                        <button
                          class="text-[10px] px-1 py-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          onClick={() => openShell(container.id)}
                          title="Shell into container"
                        >
                          Shell
                        </button>
                      </Show>

                      {isRunning() ? (
                        <button
                          class="text-[10px] px-1 py-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--danger)]"
                          onClick={() => handleDown(entry.file.path, container.service)}
                          title="Stop service"
                        >
                          Stop
                        </button>
                      ) : (
                        <button
                          class="text-[10px] px-1 py-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--success)]"
                          onClick={() => handleUp(entry.file.path, container.service)}
                          title="Start service"
                        >
                          Start
                        </button>
                      )}
                    </div>
                  </div>
                );
              }}
            </For>

            {/* Show compose-level controls when no containers exist yet */}
            <Show when={!entry.loading && entry.containers.length === 0}>
              <div class="flex items-center gap-1.5 pl-4 py-0.5">
                <span class="text-[10px] text-[var(--text-secondary)] flex-1">No containers</span>
                <button
                  class="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--success)]"
                  onClick={() => handleUp(entry.file.path)}
                  title="Start all services"
                >
                  Up
                </button>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
