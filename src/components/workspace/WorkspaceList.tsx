import { createSignal, createMemo, onMount, onCleanup, For, Show } from "solid-js";
import { state, setState } from "../../store/core";
import { api } from "../../lib/api";
import { addTerminal, setActiveTerminal, unstashTerminal, setTerminalNeedsAttention, setTerminalLastSeen } from "../../store/terminals";
import type { Workspace } from "../../store/types";
import { ClaudeIcon } from "../icons/ProviderIcons";
import EditorButton from "../shared/EditorButton";

// Tick signal — drives idle-detection checks every second
const [tick, setTick] = createSignal(0);
const IDLE_THRESHOLD = 5000;

function playAttentionChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880; // A5
    gain.gain.value = 0.08;    // very quiet
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* AudioContext may not be available */ }
}

setInterval(() => {
  setTick((t) => t + 1);
  const now = Date.now();

  // Keep lastSeenAt current for the terminal the user is actively viewing
  const activeId = state.activeTerminalId;
  if (activeId) {
    const active = state.terminals.find((at) => at.id === activeId && !at.stashed);
    if (active) setTerminalLastSeen(activeId);
  }

  // Check all Claude session terminals for idle state → set needsAttention
  for (const t of state.terminals) {
    if (
      t.sessionId &&
      t.lastOutputAt &&
      now - t.lastOutputAt > IDLE_THRESHOLD &&
      t.lastOutputAt > (t.lastSeenAt ?? 0)
    ) {
      if (!t.needsAttention) playAttentionChime();
      setTerminalNeedsAttention(t.id, true);
    }
  }
}, 1000);

interface GitInfo {
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  insertions: number;
  deletions: number;
}

export default function WorkspaceList() {
  const [adding, setAdding] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newPath, setNewPath] = createSignal("");
  const [userEditedName, setUserEditedName] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [gitInfoMap, setGitInfoMap] = createSignal<Record<string, GitInfo>>({});

  // Folder browser state
  const [browsing, setBrowsing] = createSignal(false);
  const [browseDir, setBrowseDir] = createSignal<string | null>(null);
  const [browseDirs, setBrowseDirs] = createSignal<Array<{ name: string; path: string }>>([]);
  const [browseParent, setBrowseParent] = createSignal<string | null>(null);
  const [browseLoading, setBrowseLoading] = createSignal(false);
  const [stashOpenId, setStashOpenId] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const workspaces = await api.listWorkspaces();
      setState("workspaces", workspaces);
    } catch {
      // Workspaces may not be available
    }
  });

  // Fetch git info for all workspaces periodically
  async function fetchAllGitInfo() {
    const infos: Record<string, GitInfo> = {};
    await Promise.all(
      state.workspaces.map(async (ws) => {
        try {
          const [status, ab, stats] = await Promise.all([
            api.gitStatus(ws.path),
            api.gitAheadBehind(ws.path),
            api.gitDiffStats(ws.path),
          ]);
          infos[ws.id] = {
            branch: status.branch,
            dirty: status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0,
            ahead: ab.ahead,
            behind: ab.behind,
            insertions: stats.insertions,
            deletions: stats.deletions,
          };
        } catch {
          // Not a git repo or unreachable
        }
      })
    );
    setGitInfoMap(infos);
  }

  onMount(() => {
    fetchAllGitInfo();
  });

  const gitInterval = setInterval(fetchAllGitInfo, 10_000);
  onCleanup(() => clearInterval(gitInterval));

  // Close stash popover on outside click
  function handleGlobalClick(e: MouseEvent) {
    // Skip if click originated from a stash-related element (icon, button, popover)
    const target = e.target as HTMLElement;
    if (target.closest?.("[data-stash-zone]")) return;
    if (stashOpenId()) setStashOpenId(null);
  }
  onMount(() => document.addEventListener("click", handleGlobalClick));
  onCleanup(() => document.removeEventListener("click", handleGlobalClick));

  // Auto-name from path
  function handlePathInput(value: string) {
    setNewPath(value);
    if (!userEditedName()) {
      const segment = value.replace(/\/+$/, "").split("/").pop() || "";
      setNewName(segment);
    }
  }

  function handleNameInput(value: string) {
    setNewName(value);
    setUserEditedName(true);
  }

  async function handleAdd() {
    const path = newPath().trim();
    if (!path) return;

    const name = newName().trim() || path.replace(/\/+$/, "").split("/").pop() || "workspace";

    setLoading(true);
    setError(null);
    try {
      const ws = await api.createWorkspace(name, path);
      setState("workspaces", (prev) => [{ id: ws.id, name, path } as Workspace, ...prev]);
      setNewName("");
      setNewPath("");
      setUserEditedName(false);
      setAdding(false);
      setBrowsing(false);
      // Auto-select the new workspace
      setState("activeWorkspaceId", ws.id);
      // Refresh git info for the new workspace
      fetchAllGitInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add workspace");
    } finally {
      setLoading(false);
    }
  }

  function selectWorkspace(id: string) {
    if (id === state.activeWorkspaceId) {
      // Toggle: deselect workspace, close popover
      setState("activeWorkspaceId", null);
      setStashOpenId(null);
    } else {
      // Select workspace
      setState("activeWorkspaceId", id);
      // Set active terminal to first non-stashed terminal in this workspace
      const wsTerminals = state.terminals.filter((t) => t.workspaceId === id && !t.stashed);
      if (wsTerminals.length > 0) {
        setState("activeTerminalId", wsTerminals[0].id);
        setStashOpenId(id);
      } else {
        setState("activeTerminalId", null);
        setStashOpenId(null);
      }
    }
  }

  function openTerminal(ws: Workspace) {
    addTerminal(ws.path);
  }

  // Folder browser
  async function openBrowser(initialPath?: string) {
    setBrowsing(true);
    setBrowseLoading(true);
    try {
      const result = await api.browseDir(initialPath);
      setBrowseDir(result.current);
      setBrowseDirs(result.dirs);
      setBrowseParent(result.parent);
    } catch {
      setBrowseDirs([]);
    } finally {
      setBrowseLoading(false);
    }
  }

  async function navigateTo(path: string) {
    setBrowseLoading(true);
    try {
      const result = await api.browseDir(path);
      setBrowseDir(result.current);
      setBrowseDirs(result.dirs);
      setBrowseParent(result.parent);
    } catch {
      setBrowseDirs([]);
    } finally {
      setBrowseLoading(false);
    }
  }

  function selectBrowsedDir(path: string) {
    setNewPath(path);
    if (!userEditedName()) {
      const segment = path.replace(/\/+$/, "").split("/").pop() || "";
      setNewName(segment);
    }
    setBrowsing(false);
  }

  function resetForm() {
    setAdding(false);
    setBrowsing(false);
    setNewName("");
    setNewPath("");
    setUserEditedName(false);
    setError(null);
  }

  return (
    <div class="p-2">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Workspaces</span>
        <button
          class="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          onClick={() => adding() ? resetForm() : setAdding(true)}
        >
          {adding() ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add workspace form */}
      <Show when={adding()}>
        <div class="mb-2 space-y-1.5">
          {/* Path input + Browse */}
          <div class="flex gap-1">
            <input
              class="flex-1 px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--btn-radius)] text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
              placeholder="/path/to/project"
              value={newPath()}
              onInput={(e) => handlePathInput(e.currentTarget.value)}
            />
            <button
              class="px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--border)] text-[var(--text-primary)] rounded-[var(--btn-radius)] transition-colors shrink-0"
              onClick={() => openBrowser(newPath() || undefined)}
            >
              Browse
            </button>
          </div>

          {/* Folder browser */}
          <Show when={browsing()}>
            <div class="border border-[var(--border)] rounded-[var(--btn-radius)] bg-[var(--bg-primary)] max-h-44 overflow-y-auto">
              {/* Breadcrumb */}
              <div class="px-2 py-1 text-[10px] text-[var(--text-secondary)] border-b border-[var(--border)] truncate font-mono">
                {browseDir()}
              </div>

              <Show when={browseLoading()}>
                <div class="px-2 py-2 text-xs text-[var(--text-secondary)] text-center">Loading...</div>
              </Show>

              <Show when={!browseLoading()}>
                {/* Parent directory */}
                <Show when={browseParent()}>
                  <button
                    class="w-full text-left px-2 py-1 text-xs hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
                    onClick={() => navigateTo(browseParent()!)}
                  >
                    ..
                  </button>
                </Show>

                {/* Use current directory */}
                <button
                  class="w-full text-left px-2 py-1 text-xs hover:bg-[var(--bg-tertiary)] text-[var(--accent)] font-medium transition-colors"
                  onClick={() => selectBrowsedDir(browseDir()!)}
                >
                  Select this folder
                </button>

                {/* Directory listing */}
                <For each={browseDirs()} fallback={
                  <div class="px-2 py-1 text-xs text-[var(--text-secondary)]">No subdirectories</div>
                }>
                  {(dir) => (
                    <button
                      class="w-full text-left px-2 py-1 text-xs hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors truncate"
                      onClick={() => navigateTo(dir.path)}
                    >
                      {dir.name}/
                    </button>
                  )}
                </For>
              </Show>
            </div>
          </Show>

          {/* Name input */}
          <input
            class="w-full px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--btn-radius)] text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
            placeholder="Name (auto-derived from path)"
            value={newName()}
            onInput={(e) => handleNameInput(e.currentTarget.value)}
          />

          {/* Error display */}
          <Show when={error()}>
            <div class="text-xs text-[var(--danger)] px-1">{error()}</div>
          </Show>

          {/* Add button */}
          <button
            class="w-full px-2 py-1 text-xs bg-[var(--accent)] text-[var(--bg-primary)] rounded-[var(--btn-radius)] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAdd}
            disabled={loading() || !newPath().trim()}
          >
            {loading() ? "Adding..." : "Add Workspace"}
          </button>
        </div>
      </Show>

      {/* Workspace tiles */}
      <For each={state.workspaces} fallback={
        <div class="text-xs text-[var(--text-secondary)] py-4 text-center">No workspaces added yet</div>
      }>
        {(ws) => {
          const isActive = () => ws.id === state.activeWorkspaceId;
          const git = () => gitInfoMap()[ws.id];
          const wsTerminals = createMemo(() => state.terminals.filter((t) => t.workspaceId === ws.id));
          const terminalCount = () => wsTerminals().length;
          const isStashOpen = () => stashOpenId() === ws.id;
          const attentionCount = createMemo(() => {
            tick(); // subscribe for reactivity
            return wsTerminals().filter((t) => t.needsAttention).length;
          });

          return (
            <div
              class="relative flex items-start gap-2 w-full text-left px-2 py-2 rounded-[var(--btn-radius)] text-xs mb-0.5 cursor-pointer"
              classList={{
                "border-l-2 border-l-[var(--accent)]": isActive(),
                "border-l-2 border-l-transparent": !isActive(),
              }}
              style={{
                background: isActive()
                  ? "color-mix(in srgb, var(--accent) 10%, var(--bg-tertiary))"
                  : "transparent",
                transition: "background 0.16s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive()) e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 10%, var(--bg-tertiary))";
              }}
              onMouseLeave={(e) => {
                if (!isActive()) e.currentTarget.style.background = "transparent";
              }}
              onClick={(e) => { e.stopPropagation(); selectWorkspace(ws.id); }}
            >
              {/* Workspace icon with terminal count badge */}
              <div class="relative shrink-0" data-stash-zone>
                <div
                  class="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold"
                  classList={{
                    "text-[var(--accent)]": attentionCount() === 0,
                    "text-[var(--warning)] animate-pulse": attentionCount() > 0,
                  }}
                  style={{ background: "color-mix(in srgb, var(--accent) 15%, var(--bg-tertiary))" }}
                >
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <Show when={attentionCount() > 0}>
                  <span
                    class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[var(--warning)] text-[var(--bg-primary)] text-[8px] font-bold flex items-center justify-center leading-none animate-pulse"
                  >
                    {attentionCount()}
                  </span>
                </Show>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <div class="font-medium text-[var(--text-primary)] truncate">{ws.name}</div>
                  <Show when={isActive()}>
                    <div class="flex items-center gap-1 shrink-0 ml-1">
                      {/* Stash / terminal tray button */}
                      <Show when={terminalCount() > 0}>
                        <button
                          data-stash-zone
                          class="text-[10px] px-1.5 py-0.5 rounded-[var(--btn-radius)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-0.5"
                          classList={{
                            "text-[var(--warning)] animate-pulse": attentionCount() > 0,
                            "text-[var(--text-secondary)]": attentionCount() === 0,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setStashOpenId(isStashOpen() ? null : ws.id);
                          }}
                          title={`${terminalCount()} terminal${terminalCount() > 1 ? "s" : ""}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="2" y="4" width="10" height="8" rx="1.5" />
                            <path d="M4 4V3a1.5 1.5 0 011.5-1.5h5A1.5 1.5 0 0112 3v1" />
                          </svg>
                          <span>{terminalCount()}</span>
                        </button>
                      </Show>

                      <EditorButton cwd={ws.path} size="sm" />
                      <button
                        class="text-[10px] px-1 py-0.5 rounded-[var(--btn-radius)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTerminal(ws);
                        }}
                        title="New terminal"
                      >
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                          <path d="M2 4l4 4-4 4" />
                          <path d="M8 12h6" />
                        </svg>
                      </button>
                    </div>
                  </Show>
                </div>
                <div class="text-[var(--text-secondary)] truncate mt-0.5">{ws.path}</div>
                <Show when={git()}>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      classList={{
                        "bg-[var(--success)]": !git()!.dirty,
                        "bg-[var(--warning)]": git()!.dirty,
                      }}
                    />
                    <span class="font-mono text-[10px] text-[var(--accent)]">{git()!.branch}</span>
                    <Show when={git()!.ahead > 0}>
                      <span class="text-[10px] text-[var(--text-secondary)]">{git()!.ahead}</span>
                    </Show>
                    <Show when={git()!.behind > 0}>
                      <span class="text-[10px] text-[var(--text-secondary)]">{git()!.behind}</span>
                    </Show>
                    <Show when={git()!.insertions > 0 || git()!.deletions > 0}>
                      <span class="text-[9px] font-mono text-[var(--success)]">+{git()!.insertions}</span>
                      <span class="text-[9px] font-mono text-[var(--danger)]">-{git()!.deletions}</span>
                    </Show>
                  </div>
                </Show>
              </div>

              {/* Stash popover — outside isActive gate so it renders on the same tick */}
              <Show when={isStashOpen()}>
                <div
                  data-stash-zone
                  class="absolute left-0 right-0 top-full mt-1 mx-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div class="px-2 py-1.5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">
                    Terminals
                  </div>
                  <For each={wsTerminals()}>
                    {(term) => (
                      <button
                        class="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-1.5"
                        classList={{
                          "bg-[var(--bg-tertiary)]": term.id === state.activeTerminalId && !term.stashed && !term.needsAttention,
                          "opacity-50": term.stashed && !term.needsAttention,
                          "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]": !!term.needsAttention,
                        }}
                        onClick={() => {
                          if (term.stashed) {
                            unstashTerminal(term.id);
                          } else {
                            setActiveTerminal(term.id);
                          }
                          setStashOpenId(null);
                        }}
                      >
                        <span
                          class="w-1.5 h-1.5 rounded-full shrink-0"
                          classList={{
                            "bg-[var(--warning)] animate-pulse": !!term.needsAttention,
                            "bg-[var(--success)]": !term.needsAttention && term.wsConnected && !term.stashed,
                            "bg-[var(--text-secondary)] opacity-40": !term.needsAttention && (!term.wsConnected || term.stashed),
                          }}
                        />
                        <Show when={term.sessionId}>
                          <span class="shrink-0 flex items-center"><ClaudeIcon size={10} /></span>
                        </Show>
                        <span class="truncate" classList={{
                          "text-[var(--warning)]": !!term.needsAttention,
                          "text-[var(--text-primary)]": !term.needsAttention && !term.stashed,
                          "text-[var(--text-secondary)] italic": !term.needsAttention && term.stashed,
                        }}>
                          {term.stashed ? "↑ " : ""}{term.customTitle || term.sessionTitle || term.title || term.cwd.split("/").pop() || "terminal"}
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
