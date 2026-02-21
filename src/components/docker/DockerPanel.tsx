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

function projectSummary(containers: ContainerInfo[]) {
  const running = containers.filter((c) => c.state === "running").length;
  const stopped = containers.filter((c) => c.state !== "running").length;
  return { running, stopped, total: containers.length };
}

/* ── Inline SVG icons (16×16 viewBox, 12×12 rendered) ────────────── */

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="4,2 14,8 4,14" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="3" width="10" height="10" rx="1" />
    </svg>
  );
}

function PullIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="8" y1="2" x2="8" y2="11" />
      <polyline points="4,8 8,12 12,8" />
      <line x1="3" y1="14" x2="13" y2="14" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 8a6 6 0 0 1 10.3-4.2" />
      <polyline points="13,2 13,5.5 9.5,5.5" />
      <path d="M14 8a6 6 0 0 1-10.3 4.2" />
      <polyline points="3,14 3,10.5 6.5,10.5" />
    </svg>
  );
}

function LogsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="3" y1="8" x2="11" y2="8" />
      <line x1="3" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ShellIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3,4 7,8 3,12" />
      <line x1="9" y1="12" x2="13" y2="12" />
    </svg>
  );
}

const BTN = "w-5 h-5 flex items-center justify-center rounded-[var(--btn-radius)] hover:bg-[var(--bg-tertiary)] transition-colors";

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

  createEffect(() => {
    const _wsId = state.activeWorkspaceId;
    discover();
  });

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

  async function handleRestart(composePath: string, service?: string) {
    await api.dockerRestart(composePath, service);
    refreshContainers();
  }

  async function handlePull(composePath: string, service?: string) {
    await api.dockerPull(composePath, service);
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

  function statusDotColor(containers: ContainerInfo[]): string {
    if (containers.length === 0) return "bg-[var(--text-secondary)]";
    const { running, total } = projectSummary(containers);
    if (running === total) return "bg-[var(--success)]";
    if (running > 0) return "bg-[var(--warning)]";
    return "bg-[var(--text-secondary)]";
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
        {(entry) => {
          const summary = () => projectSummary(entry.containers);
          const hasContainers = () => entry.containers.length > 0;
          const anyRunning = () => summary().running > 0;
          const anyStopped = () => !hasContainers() || summary().running < summary().total;

          return (
            <div class="mb-2">
              {/* ── Project header ── */}
              <div class="flex items-center gap-1.5 mb-1">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="shrink-0">
                  <rect x="1" y="3" width="14" height="10" rx="1.5" />
                  <path d="M5 3V1.5h6V3" />
                </svg>
                <span class="text-xs font-medium text-[var(--text-primary)] truncate" title={entry.file.path}>
                  {entry.file.name}
                </span>

                {/* Status badge */}
                <Show when={!entry.loading && hasContainers()}>
                  <span class="flex items-center gap-1 shrink-0">
                    <span class={`w-1.5 h-1.5 rounded-full ${statusDotColor(entry.containers)}`} />
                    <span class="text-[10px] text-[var(--text-secondary)]">
                      {summary().running}/{summary().total}
                    </span>
                  </span>
                </Show>

                <span class="flex-1" />

                {/* Always-visible project-level icon buttons */}
                <Show when={!entry.loading}>
                  <div class="flex items-center gap-0.5 shrink-0">
                    <Show when={anyStopped()}>
                      <button
                        class={`${BTN} text-[var(--success)]`}
                        onClick={() => handleUp(entry.file.path)}
                        title="Start all services"
                      >
                        <PlayIcon />
                      </button>
                    </Show>
                    <Show when={anyRunning()}>
                      <button
                        class={`${BTN} text-[var(--danger)]`}
                        onClick={() => handleDown(entry.file.path)}
                        title="Stop all services"
                      >
                        <StopIcon />
                      </button>
                    </Show>
                    <button
                      class={`${BTN} text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
                      onClick={() => handlePull(entry.file.path)}
                      title="Pull latest images"
                    >
                      <PullIcon />
                    </button>
                  </div>
                </Show>
              </div>

              <Show when={entry.loading}>
                <div class="text-[10px] text-[var(--text-secondary)] pl-4">Loading...</div>
              </Show>

              {/* Per-container rows */}
              <For each={entry.containers}>
                {(container) => {
                  const isRunning = () => container.state === "running";
                  return (
                    <div class="flex items-center gap-1.5 pl-4 py-0.5 group/container">
                      <span class={`w-1.5 h-1.5 rounded-full shrink-0 ${stateColor(container.state)}`} />
                      <span class="text-xs text-[var(--text-primary)] truncate flex-1" title={container.name}>
                        {container.service}
                      </span>
                      <span class="text-[10px] text-[var(--text-secondary)] shrink-0" title={container.status}>
                        {container.state}
                      </span>

                      {/* Hover-reveal per-container actions */}
                      <div class="flex items-center gap-0.5 opacity-0 group-hover/container:opacity-100 transition-opacity shrink-0">
                        {/* Logs — always available */}
                        <button
                          class={`${BTN} text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
                          onClick={() => openLogs(container.id)}
                          title="Stream logs in terminal"
                        >
                          <LogsIcon />
                        </button>

                        {/* Shell — running only */}
                        <Show when={isRunning()}>
                          <button
                            class={`${BTN} text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
                            onClick={() => openShell(container.id)}
                            title="Shell into container"
                          >
                            <ShellIcon />
                          </button>
                        </Show>

                        {/* Restart — running only */}
                        <Show when={isRunning()}>
                          <button
                            class={`${BTN} text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
                            onClick={() => handleRestart(entry.file.path, container.service)}
                            title="Restart service"
                          >
                            <RestartIcon />
                          </button>
                        </Show>

                        {/* Stop/Start toggle */}
                        {isRunning() ? (
                          <button
                            class={`${BTN} text-[var(--danger)]`}
                            onClick={() => handleDown(entry.file.path, container.service)}
                            title="Stop service"
                          >
                            <StopIcon />
                          </button>
                        ) : (
                          <button
                            class={`${BTN} text-[var(--success)]`}
                            onClick={() => handleUp(entry.file.path, container.service)}
                            title="Start service"
                          >
                            <PlayIcon />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          );
        }}
      </For>
    </div>
  );
}
