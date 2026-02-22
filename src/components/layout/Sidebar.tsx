import { For, Show, createEffect, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { state, setState } from "../../store/core";
import SessionList from "../session/SessionList";
import ProviderTabs from "../session/ProviderTabs";
import DockerPanel from "../docker/DockerPanel";
import WorkspaceList from "../workspace/WorkspaceList";
import EditorButton from "../shared/EditorButton";
import SettingsPanel from "../settings/SettingsPanel";
import { buildNewSessionCommand, buildResumeCommand, PROVIDER_ICONS, PROVIDER_LABELS } from "../../lib/providers";
import { addTerminal, setActiveTerminal, setTerminalMuted, unstashTerminal } from "../../store/terminals";
import { createWorkspace } from "../../store/workspaces";
import { api } from "../../lib/api";
import { isTauriRuntime, pickWorkspaceDirectory } from "../../lib/workspace-picker";
import type { Provider, SessionInfo, TerminalInstance } from "../../store/types";

function SectionHeader(props: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  actions?: JSX.Element;
}) {
  return (
    <div class="flex items-center w-full px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider hover:bg-[var(--bg-tertiary)] transition-colors">
      <button
        class="flex items-center gap-1 flex-1 min-w-0"
        onClick={props.onToggle}
      >
        <span>{props.label}</span>
        <svg
          class="w-3 h-3 transition-transform shrink-0"
          classList={{ "rotate-[-90deg]": props.collapsed }}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      <Show when={props.actions}>
        <div class="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {props.actions}
        </div>
      </Show>
    </div>
  );
}

export default function Sidebar() {
  let sidebarRef: HTMLDivElement | undefined;
  const previewProviders: Provider[] = ["claude", "codex", "opencode", "gemini"];
  const tauriRuntime = isTauriRuntime();

  const [hovering, setHovering] = createSignal(false);
  const [previewWorkspaceId, setPreviewWorkspaceId] = createSignal<string | null>(null);
  const [expandedHoverWorkspaceId, setExpandedHoverWorkspaceId] = createSignal<string | null>(null);
  const [expandedHoverTop, setExpandedHoverTop] = createSignal(16);
  const [expandedHoverTab, setExpandedHoverTab] = createSignal<"all" | "sessions" | "active" | "stashed">("sessions");
  const [expandedHoverProvider, setExpandedHoverProvider] = createSignal<Provider>(state.activeProvider);
  const [panelSessionTab, setPanelSessionTab] = createSignal<"all" | "sessions" | "active" | "stashed">("sessions");
  const [expandedHoverSessions, setExpandedHoverSessions] = createSignal<SessionInfo[]>([]);
  const [expandedHoverLoading, setExpandedHoverLoading] = createSignal(false);
  const [stashOpen, setStashOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [addingWorkspace, setAddingWorkspace] = createSignal(false);
  const [addWorkspaceError, setAddWorkspaceError] = createSignal<string | null>(null);
  const previewSessionCache = new Map<string, SessionInfo[]>();
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  let expandedHoverLeaveTimer: ReturnType<typeof setTimeout> | undefined;
  let expandedHoverRequestId = 0;
  let lastPointerDownInStashZone = false;

  const openFlyout = () => {
    if (state.sidebarOpen) return;
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = undefined;
    }
    setExpandedHoverWorkspaceId(null);
    setPreviewWorkspaceId((prev) => prev ?? state.activeWorkspaceId);
    setHovering(true);
  };

  const closeFlyoutSoon = () => {
    if (state.sidebarOpen) return;
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      setHovering(false);
      setPreviewWorkspaceId(null);
      leaveTimer = undefined;
    }, 140);
  };

  onCleanup(() => {
    if (leaveTimer) clearTimeout(leaveTimer);
    if (expandedHoverLeaveTimer) clearTimeout(expandedHoverLeaveTimer);
  });

  function openExpandedHoverPreview(workspaceId: string, target: HTMLElement) {
    if (expandedHoverLeaveTimer) {
      clearTimeout(expandedHoverLeaveTimer);
      expandedHoverLeaveTimer = undefined;
    }

    const root = sidebarRef?.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const cardHeight = 290;
    const minTop = 10;
    const maxTop = root ? Math.max(minTop, root.height - cardHeight - 10) : 420;
    const nextTop = root ? Math.max(minTop, Math.min(maxTop, rect.top - root.top - 8)) : 16;

    setExpandedHoverTop(nextTop);
    setExpandedHoverTab("sessions");
    setExpandedHoverProvider(state.activeProvider);
    setExpandedHoverWorkspaceId(workspaceId);
  }

  function closeExpandedHoverPreviewSoon() {
    if (expandedHoverLeaveTimer) clearTimeout(expandedHoverLeaveTimer);
    expandedHoverLeaveTimer = setTimeout(() => {
      setExpandedHoverWorkspaceId(null);
      expandedHoverLeaveTimer = undefined;
    }, 120);
  }

  function cancelExpandedHoverClose() {
    if (expandedHoverLeaveTimer) {
      clearTimeout(expandedHoverLeaveTimer);
      expandedHoverLeaveTimer = undefined;
    }
  }

  function handlePointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    lastPointerDownInStashZone = !!target.closest?.("[data-sidebar-stash-zone]");
  }

  function handleGlobalClick() {
    if (lastPointerDownInStashZone) return;
    if (stashOpen()) setStashOpen(false);
  }

  onMount(() => {
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleGlobalClick);
  });

  onCleanup(() => {
    document.removeEventListener("pointerdown", handlePointerDown, true);
    document.removeEventListener("click", handleGlobalClick);
  });

  createEffect(() => {
    state.activeWorkspaceId;
    setStashOpen(false);
    setPanelSessionTab("sessions");
    setExpandedHoverWorkspaceId(null);
    if (state.sidebarOpen) return;
    setPreviewWorkspaceId((prev) => prev ?? state.activeWorkspaceId);
  });

  createEffect(async () => {
    const workspaceId = expandedHoverWorkspaceId();
    const provider = expandedHoverProvider();

    if (!workspaceId) {
      setExpandedHoverSessions([]);
      setExpandedHoverLoading(false);
      return;
    }

    const workspace = state.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      setExpandedHoverSessions([]);
      setExpandedHoverLoading(false);
      return;
    }

    const cacheKey = `${provider}:${workspaceId}`;
    const cached = previewSessionCache.get(cacheKey);
    if (cached) {
      setExpandedHoverSessions(cached.slice(0, 4));
    }

    const requestId = ++expandedHoverRequestId;
    setExpandedHoverLoading(!cached);

    try {
      const sessions = await api.listSessions(workspace.path, provider);
      if (requestId !== expandedHoverRequestId) return;
      previewSessionCache.set(cacheKey, sessions);
      setExpandedHoverSessions(sessions.slice(0, 4));
    } catch {
      if (requestId !== expandedHoverRequestId) return;
      if (!cached) setExpandedHoverSessions([]);
    } finally {
      if (requestId !== expandedHoverRequestId) return;
      setExpandedHoverLoading(false);
    }
  });

  const attentionCount = (workspaceId: string) =>
    state.terminals.filter((terminal) => terminal.workspaceId === workspaceId && !!terminal.needsAttention).length;

  const panelWorkspaceId = () => (state.sidebarOpen ? state.activeWorkspaceId : previewWorkspaceId() ?? state.activeWorkspaceId);
  const panelWorkspace = () => state.workspaces.find((workspace) => workspace.id === panelWorkspaceId());
  const expandedHoverWorkspace = () => state.workspaces.find((workspace) => workspace.id === expandedHoverWorkspaceId());
  const expandedHoverWorkspaceTerminals = () =>
    state.terminals.filter((terminal) => terminal.workspaceId === expandedHoverWorkspaceId());
  const expandedHoverAllTerminals = () => expandedHoverWorkspaceTerminals();
  const expandedHoverActiveTerminals = () =>
    expandedHoverWorkspaceTerminals().filter((terminal) => !terminal.stashed);
  const expandedHoverStashedTerminals = () =>
    expandedHoverWorkspaceTerminals().filter((terminal) => terminal.stashed);
  const expandedHoverAllAttentionCount = () => expandedHoverAllTerminals().filter((terminal) => !!terminal.needsAttention).length;
  const expandedHoverActiveAttentionCount = () => expandedHoverActiveTerminals().filter((terminal) => !!terminal.needsAttention).length;
  const expandedHoverStashedAttentionCount = () => expandedHoverStashedTerminals().filter((terminal) => !!terminal.needsAttention).length;
  const workspaceTerminals = () =>
    state.terminals.filter((terminal) => terminal.workspaceId === panelWorkspaceId());
  const panelAllTerminals = () => workspaceTerminals();
  const panelActiveTerminals = () => workspaceTerminals().filter((terminal) => !terminal.stashed);
  const panelStashedTerminals = () => workspaceTerminals().filter((terminal) => terminal.stashed);
  const panelAllAttentionCount = () => panelAllTerminals().filter((terminal) => !!terminal.needsAttention).length;
  const panelActiveAttentionCount = () => panelActiveTerminals().filter((terminal) => !!terminal.needsAttention).length;
  const panelStashedAttentionCount = () => panelStashedTerminals().filter((terminal) => !!terminal.needsAttention).length;
  const sidebarShortcut = () => (typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "Cmd" : "Ctrl");

  const normalizeWorkspacePath = (value: string) => value.replace(/\/+$/, "") || "/";

  function suggestedWorkspaceName(path: string) {
    const segment = normalizeWorkspacePath(path).split("/").pop() || "workspace";
    if (!state.workspaces.some((workspace) => workspace.name === segment)) return segment;

    for (let suffix = 2; suffix < 1000; suffix++) {
      const candidate = `${segment}-${suffix}`;
      if (!state.workspaces.some((workspace) => workspace.name === candidate)) return candidate;
    }

    return `${segment}-${Date.now()}`;
  }

  function activateWorkspace(workspaceId: string) {
    setState("activeWorkspaceId", workspaceId);
    setPreviewWorkspaceId(workspaceId);
    setExpandedHoverWorkspaceId(null);

    const visible = state.terminals.filter((terminal) => terminal.workspaceId === workspaceId && !terminal.stashed);
    setState("activeTerminalId", visible[0]?.id ?? null);
  }

  async function addWorkspaceFromPicker() {
    if (addingWorkspace()) return;

    setAddWorkspaceError(null);
    setAddingWorkspace(true);
    try {
      const initialPath = panelWorkspace()?.path ?? undefined;
      let pickedPath: string | null = null;

      try {
        pickedPath = await pickWorkspaceDirectory(initialPath);
      } catch (err) {
        console.error("[bord] folder picker failed:", err);
      }

      // Fallback: manual path entry (web mode, or if native picker failed)
      if (!pickedPath) {
        const entered = window.prompt(
          "Enter the full local project path:",
          initialPath ?? "",
        );
        if (entered) pickedPath = entered.trim();
      }

      if (!pickedPath) return;

      const normalizedPicked = normalizeWorkspacePath(pickedPath);
      const existing = state.workspaces.find(
        (workspace) => normalizeWorkspacePath(workspace.path) === normalizedPicked,
      );

      if (existing) {
        activateWorkspace(existing.id);
        return;
      }

      const name = suggestedWorkspaceName(normalizedPicked);
      const createdId = await createWorkspace(name, normalizedPicked);
      activateWorkspace(createdId);
      setState("sidebarOpen", true);
    } catch (error) {
      console.error("[bord] Failed to add workspace:", error);
      const message = error instanceof Error ? error.message : "Failed to add workspace";
      setAddWorkspaceError(message);
    } finally {
      setAddingWorkspace(false);
    }
  }

  function activatePanelTerminal(terminal: TerminalInstance) {
    const workspaceId = panelWorkspaceId();
    if (workspaceId && workspaceId !== state.activeWorkspaceId) {
      activateWorkspace(workspaceId);
    }

    if (terminal.stashed) {
      unstashTerminal(terminal.id);
    } else {
      setActiveTerminal(terminal.id);
    }
    setStashOpen(false);
  }

  function activatePreviewTerminal(terminal: TerminalInstance) {
    const workspaceId = expandedHoverWorkspaceId();
    if (!workspaceId) return;
    if (workspaceId !== state.activeWorkspaceId) {
      activateWorkspace(workspaceId);
    }

    if (terminal.stashed) {
      unstashTerminal(terminal.id);
    } else {
      setActiveTerminal(terminal.id);
    }
    setExpandedHoverWorkspaceId(null);
  }

  function openPreviewSession(session: SessionInfo) {
    const workspace = expandedHoverWorkspace();
    if (!workspace) return;

    if (workspace.id !== state.activeWorkspaceId) {
      activateWorkspace(workspace.id);
    }

    const linkedTerminal = state.terminals.find((terminal) => terminal.sessionId === session.id);
    if (linkedTerminal) {
      if (linkedTerminal.stashed) {
        unstashTerminal(linkedTerminal.id);
      } else {
        setActiveTerminal(linkedTerminal.id);
      }
    } else {
      addTerminal(workspace.path, buildResumeCommand(session.provider, session.id), session.title);
    }

    setExpandedHoverWorkspaceId(null);
  }

  const panel = () => (
    <div class="flex flex-col h-full w-72 bg-[var(--bg-secondary)] min-w-0">
      <div class="relative px-3 py-2 border-b border-[var(--border)]">
        <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
            <div class="text-sm font-semibold text-[var(--text-primary)] truncate">{panelWorkspace()?.name ?? "bord"}</div>
            <div class="text-xs text-[var(--text-secondary)] truncate">{panelWorkspace()?.path ?? "Select a workspace"}</div>
          </div>

          <Show when={panelWorkspace()}>
            <div data-sidebar-stash-zone class="relative flex items-center gap-1 shrink-0">
              <Show when={workspaceTerminals().length > 0}>
                <button
                  data-stash-zone
                  data-stash-tray-button
                  data-sidebar-stash-zone
                  class="text-[10px] px-1.5 py-0.5 rounded-[var(--btn-radius)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-0.5"
                  classList={{
                    "text-[var(--warning)] animate-pulse": attentionCount(panelWorkspace()!.id) > 0,
                    "text-[var(--text-secondary)]": attentionCount(panelWorkspace()!.id) === 0,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setStashOpen((v) => !v);
                  }}
                  title={`${workspaceTerminals().length} terminal${workspaceTerminals().length > 1 ? "s" : ""}`}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="2" y="4" width="10" height="8" rx="1.5" />
                    <path d="M4 4V3a1.5 1.5 0 011.5-1.5h5A1.5 1.5 0 0112 3v1" />
                  </svg>
                  <span>{workspaceTerminals().length}</span>
                </button>
              </Show>
              <EditorButton cwd={panelWorkspace()!.path} size="sm" />
            </div>
          </Show>
        </div>

        <Show when={stashOpen() && panelWorkspace()}>
          <div
            data-stash-zone
            data-sidebar-stash-zone
            class="absolute left-0 right-0 top-full mt-1 mx-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="px-2 py-1.5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">
              Terminals
            </div>
            <For each={workspaceTerminals()}>
              {(term) => (
                <div
                  data-stash-zone
                  data-sidebar-stash-zone
                  class="flex items-center px-2 py-1.5 text-xs hover:bg-[var(--bg-tertiary)] transition-colors gap-1.5"
                  classList={{
                    "bg-[var(--bg-tertiary)]": term.id === state.activeTerminalId && !term.stashed && !term.needsAttention,
                    "opacity-50": term.stashed && !term.needsAttention,
                    "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]": !!term.needsAttention,
                  }}
                >
                  <button
                    class="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                    onClick={() => {
                      const workspaceId = panelWorkspaceId();
                      if (workspaceId && workspaceId !== state.activeWorkspaceId) {
                        setState("activeWorkspaceId", workspaceId);
                      }
                      if (term.stashed) {
                        unstashTerminal(term.id);
                      } else {
                        setActiveTerminal(term.id);
                      }
                      setStashOpen(false);
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
                    <Show when={term.provider}>
                      {(() => {
                        const Icon = PROVIDER_ICONS[term.provider!];
                        return <span class="shrink-0 flex items-center"><Icon size={10} /></span>;
                      })()}
                    </Show>
                    <span
                      class="truncate"
                      classList={{
                        "text-[var(--warning)]": !!term.needsAttention,
                        "text-[var(--text-primary)]": !term.needsAttention && !term.stashed,
                        "text-[var(--text-secondary)] italic": !term.needsAttention && term.stashed,
                      }}
                    >
                      {term.stashed ? "↑ " : ""}
                      {term.customTitle || term.sessionTitle || term.title || term.cwd.split("/").pop() || "terminal"}
                    </span>
                  </button>
                  <button
                    data-stash-zone
                    data-sidebar-stash-zone
                    class="shrink-0 flex items-center justify-center rounded-[var(--btn-radius)] transition-colors"
                    classList={{
                      "text-[var(--text-secondary)] opacity-50 hover:opacity-100": !!term.muted,
                      "text-[var(--text-secondary)] opacity-30 hover:opacity-60": !term.muted,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTerminalMuted(term.id, !term.muted);
                    }}
                    title={term.muted ? "Unmute notifications" : "Mute notifications"}
                  >
                    {term.muted ? (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                        <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
                        <path d="M6.5 12a1.5 1.5 0 003 0" />
                        <path d="M2 2l12 12" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                        <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
                        <path d="M6.5 12a1.5 1.5 0 003 0" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <ProviderTabs
        actions={
          <>
            <button
              class="w-7 h-7 rounded-[var(--btn-radius)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors"
              onClick={() => {
                const ws = panelWorkspace();
                if (!ws) return;
                activateWorkspace(ws.id);
                addTerminal(ws.path, buildNewSessionCommand(state.activeProvider));
              }}
              title={`New ${PROVIDER_LABELS[state.activeProvider]} session`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M8 3v10" />
                <path d="M3 8h10" />
              </svg>
            </button>
            <button
              class="w-7 h-7 rounded-[var(--btn-radius)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors"
              onClick={() => {
                const ws = panelWorkspace();
                if (!ws) return;
                activateWorkspace(ws.id);
                addTerminal(ws.path);
              }}
              title="New terminal"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M3 4l4 4-4 4" />
                <path d="M9 12h4" />
              </svg>
            </button>
          </>
        }
      />

      <div class="flex-1 min-h-0 flex flex-col">
        <SectionHeader
          label="Sessions"
          collapsed={state.sidebarCollapsed.sessions}
          onToggle={() => setState("sidebarCollapsed", "sessions", (v) => !v)}
        />
        <Show when={!state.sidebarCollapsed.sessions}>
          <div class="px-2 py-1.5 border-b border-[var(--border)] flex items-center justify-center gap-1">
            <button
              data-panel-session-tab="sessions"
              class="px-2 py-1 text-[10px] rounded-[var(--btn-radius)] transition-colors"
              classList={{
                "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-tertiary))] text-[var(--text-primary)]": panelSessionTab() === "sessions",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": panelSessionTab() !== "sessions",
              }}
              onClick={() => setPanelSessionTab("sessions")}
            >
              Sessions
            </button>
            <button
              data-panel-session-tab="all"
              class="px-2 py-1 text-[10px] rounded-[var(--btn-radius)] transition-colors inline-flex items-center gap-1"
              classList={{
                "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-tertiary))] text-[var(--text-primary)]": panelSessionTab() === "all",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": panelSessionTab() !== "all",
              }}
              onClick={() => setPanelSessionTab("all")}
            >
              <span>All {panelAllTerminals().length}</span>
              <Show when={panelAllAttentionCount() > 0}>
                <span class="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
              </Show>
            </button>
            <button
              data-panel-session-tab="active"
              class="px-2 py-1 text-[10px] rounded-[var(--btn-radius)] transition-colors inline-flex items-center gap-1"
              classList={{
                "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-tertiary))] text-[var(--text-primary)]": panelSessionTab() === "active",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": panelSessionTab() !== "active",
              }}
              onClick={() => setPanelSessionTab("active")}
            >
              <span>Active {panelActiveTerminals().length}</span>
              <Show when={panelActiveAttentionCount() > 0}>
                <span class="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
              </Show>
            </button>
            <button
              data-panel-session-tab="stashed"
              class="px-2 py-1 text-[10px] rounded-[var(--btn-radius)] transition-colors inline-flex items-center gap-1"
              classList={{
                "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-tertiary))] text-[var(--text-primary)]": panelSessionTab() === "stashed",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": panelSessionTab() !== "stashed",
              }}
              onClick={() => setPanelSessionTab("stashed")}
            >
              <span>Stashed {panelStashedTerminals().length}</span>
              <Show when={panelStashedAttentionCount() > 0}>
                <span class="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
              </Show>
            </button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto">
            <Show when={panelSessionTab() === "all"}>
              <div class="px-2 pb-2">
                <For
                  each={panelAllTerminals()}
                  fallback={<div class="text-xs text-[var(--text-secondary)] py-4 text-center">No terminals</div>}
                >
                  {(terminal) => {
                    const Icon = terminal.provider ? PROVIDER_ICONS[terminal.provider] : undefined;
                    return (
                      <button
                        class="w-full text-left px-2 py-1.5 rounded-[var(--btn-radius)] text-xs mb-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-tertiary))]"
                        classList={{
                          "bg-[var(--bg-tertiary)]": terminal.id === state.activeTerminalId && !terminal.stashed && !terminal.needsAttention,
                          "opacity-50": terminal.stashed && !terminal.needsAttention,
                          "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]": !!terminal.needsAttention,
                        }}
                        onClick={() => activatePanelTerminal(terminal)}
                      >
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span
                            class="w-1.5 h-1.5 rounded-full shrink-0"
                            classList={{
                              "bg-[var(--warning)] animate-pulse": !!terminal.needsAttention,
                              "bg-[var(--success)]": !terminal.needsAttention && terminal.wsConnected && !terminal.stashed,
                              "bg-[var(--text-secondary)] opacity-40": !terminal.needsAttention && (!terminal.wsConnected || terminal.stashed),
                            }}
                          />
                          {Icon ? <Icon size={11} /> : null}
                          <span
                            class="truncate"
                            classList={{
                              "text-[var(--warning)]": !!terminal.needsAttention,
                              "text-[var(--text-primary)]": !terminal.needsAttention && !terminal.stashed,
                              "text-[var(--text-secondary)] italic": !terminal.needsAttention && terminal.stashed,
                            }}
                          >
                            {terminal.stashed ? "↑ " : ""}
                            {terminal.customTitle || terminal.sessionTitle || terminal.title || terminal.cwd.split("/").pop() || "terminal"}
                          </span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>

            <Show when={panelSessionTab() === "sessions"}>
              <SessionList workspaceId={panelWorkspaceId()} />
            </Show>

            <Show when={panelSessionTab() === "active"}>
              <div class="px-2 pb-2">
                <For
                  each={panelActiveTerminals()}
                  fallback={<div class="text-xs text-[var(--text-secondary)] py-4 text-center">No active terminals</div>}
                >
                  {(terminal) => {
                    const Icon = terminal.provider ? PROVIDER_ICONS[terminal.provider] : undefined;
                    return (
                      <button
                        class="w-full text-left px-2 py-1.5 rounded-[var(--btn-radius)] text-xs mb-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-tertiary))]"
                        classList={{
                          "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]": !!terminal.needsAttention,
                        }}
                        onClick={() => activatePanelTerminal(terminal)}
                      >
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span
                            class="w-1.5 h-1.5 rounded-full shrink-0"
                            classList={{
                              "bg-[var(--warning)] animate-pulse": !!terminal.needsAttention,
                              "bg-[var(--success)]": !terminal.needsAttention,
                            }}
                          />
                          {Icon ? <Icon size={11} /> : null}
                          <span class="truncate text-[var(--text-primary)]">{terminal.customTitle || terminal.sessionTitle || terminal.title || "terminal"}</span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>

            <Show when={panelSessionTab() === "stashed"}>
              <div class="px-2 pb-2">
                <For
                  each={panelStashedTerminals()}
                  fallback={<div class="text-xs text-[var(--text-secondary)] py-4 text-center">No stashed terminals</div>}
                >
                  {(terminal) => {
                    const Icon = terminal.provider ? PROVIDER_ICONS[terminal.provider] : undefined;
                    return (
                      <button
                        class="w-full text-left px-2 py-1.5 rounded-[var(--btn-radius)] text-xs mb-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-tertiary))]"
                        classList={{
                          "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]": !!terminal.needsAttention,
                        }}
                        onClick={() => activatePanelTerminal(terminal)}
                      >
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span
                            class="w-1.5 h-1.5 rounded-full shrink-0"
                            classList={{
                              "bg-[var(--warning)] animate-pulse": !!terminal.needsAttention,
                              "bg-[var(--warning)]": !terminal.needsAttention,
                            }}
                          />
                          {Icon ? <Icon size={11} /> : null}
                          <span class="truncate text-[var(--text-secondary)] italic">↑ {terminal.customTitle || terminal.sessionTitle || terminal.title || "terminal"}</span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      <div class="border-t border-[var(--border)]" />

      <div class="shrink-0">
        <SectionHeader
          label="Docker"
          collapsed={state.sidebarCollapsed.docker}
          onToggle={() => setState("sidebarCollapsed", "docker", (v) => !v)}
        />
        <Show when={!state.sidebarCollapsed.docker}>
          <DockerPanel />
        </Show>
      </div>
    </div>
  );

  return (
    <div
      ref={sidebarRef}
      data-bord-sidebar
      class="relative h-full shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border)]"
      style={{ width: state.sidebarOpen ? "22rem" : "4rem" }}
    >
      <div class="hidden" aria-hidden="true">
        <WorkspaceList />
      </div>

      <div class="flex h-full">
        <div data-bord-sidebar-rail class="w-16 shrink-0 flex flex-col items-center py-2 gap-2">
          <button
            class="w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-center"
            title={`Toggle sidebar ${sidebarShortcut()}+B`}
            onMouseEnter={() => {
              if (!state.sidebarOpen) openFlyout();
            }}
            onMouseLeave={() => {
              if (!state.sidebarOpen) closeFlyoutSoon();
            }}
            onClick={(e) => {
              e.stopPropagation();
              setState("sidebarOpen", (v) => !v);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M2.5 3.5h11" />
              <path d="M2.5 8h11" />
              <path d="M2.5 12.5h11" />
            </svg>
          </button>

          <div class="w-full flex-1 min-h-0 overflow-y-auto px-1.5 pt-1 space-y-1.5">
            <For each={state.workspaces}>
              {(workspace) => {
                const isActive = () => workspace.id === state.activeWorkspaceId;
                const workspaceTerminals = () =>
                  state.terminals.filter((terminal) => terminal.workspaceId === workspace.id);
                const totalCount = () => workspaceTerminals().length;
                const activeCount = () => workspaceTerminals().filter((terminal) => !terminal.stashed).length;
                const stashedCount = () => workspaceTerminals().filter((terminal) => terminal.stashed).length;
                return (
                  <button
                    class="relative w-full h-11 rounded-lg border text-sm font-semibold transition-colors"
                    classList={{
                      "border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,var(--bg-tertiary))]": isActive(),
                      "border-transparent text-[var(--text-secondary)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-tertiary))] hover:border-[var(--border)] hover:text-[var(--text-primary)]": !isActive(),
                    }}
                    title={workspace.name}
                    onMouseEnter={(e) => {
                      openExpandedHoverPreview(workspace.id, e.currentTarget as HTMLElement);
                      if (!state.sidebarOpen) setPreviewWorkspaceId(workspace.id);
                    }}
                    onMouseLeave={closeExpandedHoverPreviewSoon}
                    onClick={(e) => {
                      e.stopPropagation();
                      activateWorkspace(workspace.id);
                    }}
                    >
                    {workspace.name.charAt(0).toUpperCase()}

                    <Show when={totalCount() > 0}>
                      <span class="absolute left-1/2 -translate-x-1/2 bottom-0.5 px-1 rounded bg-[color-mix(in_srgb,var(--bg-primary)_70%,transparent)] text-[8px] leading-none tracking-wide text-[var(--text-secondary)]">
                        {totalCount()}-{activeCount()}-{stashedCount()}
                      </span>
                    </Show>

                    <Show when={attentionCount(workspace.id) > 0}>
                      <span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--warning)] text-[var(--bg-primary)] text-[9px] font-bold flex items-center justify-center leading-none">
                        {attentionCount(workspace.id)}
                      </span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>

          <Show when={addWorkspaceError()}>
            <div
              class="w-10 h-10 flex items-center justify-center cursor-pointer"
              title={addWorkspaceError()!}
              onClick={() => setAddWorkspaceError(null)}
            >
              <span class="text-red-400 text-[10px] font-medium">err</span>
            </div>
          </Show>
          <button
            class="w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-center"
            classList={{ "opacity-60 cursor-wait": addingWorkspace() }}
            title="Open project"
            onClick={(e) => {
              e.stopPropagation();
              void addWorkspaceFromPicker();
            }}
            disabled={addingWorkspace()}
          >
            <Show
              when={!addingWorkspace()}
              fallback={<span class="text-[10px] font-medium">...</span>}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M8 3v10" />
                <path d="M3 8h10" />
              </svg>
            </Show>
          </button>
          <button
            class="w-10 h-10 mt-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-center"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="2.5" />
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.8 2.8l1.1 1.1M12.1 12.1l1.1 1.1M13.2 2.8l-1.1 1.1M3.9 12.1l-1.1 1.1" />
            </svg>
          </button>
        </div>

        <Show when={state.sidebarOpen}>
          <div data-bord-sidebar-panel="expanded" class="h-full border-l border-[var(--border)]">{panel()}</div>
        </Show>
      </div>

      <Show when={expandedHoverWorkspace() && !(hovering() && !state.sidebarOpen)}>
        <div
          class="absolute z-50 left-[4.5rem] w-[20.25rem] rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-[0_14px_40px_rgba(0,0,0,0.45)] popover-appear overflow-hidden"
          style={{ top: `${expandedHoverTop()}px` }}
          onMouseEnter={cancelExpandedHoverClose}
          onMouseLeave={closeExpandedHoverPreviewSoon}
        >
          <div class="px-3 py-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-tertiary)_55%,transparent)]">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-8 h-8 rounded-md bg-[color-mix(in_srgb,var(--accent)_20%,var(--bg-tertiary))] border border-[var(--border)] text-[var(--accent)] font-semibold flex items-center justify-center shrink-0">
                {expandedHoverWorkspace()!.name.charAt(0).toUpperCase()}
              </span>
              <div class="min-w-0">
                <div class="text-sm font-semibold text-[var(--text-primary)] truncate">{expandedHoverWorkspace()!.name}</div>
                <div class="text-[11px] text-[var(--text-secondary)] truncate">{expandedHoverWorkspace()!.path}</div>
              </div>
              <Show when={expandedHoverWorkspace()!.id !== state.activeWorkspaceId}>
                <button
                  class="ml-auto px-2 py-1 text-[10px] rounded-[var(--btn-radius)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  onClick={() => {
                    const workspaceId = expandedHoverWorkspace()!.id;
                    activateWorkspace(workspaceId);
                  }}
                >
                  Open
                </button>
              </Show>
            </div>
          </div>

          <div class="px-2 py-1.5 border-b border-[var(--border)]">
            <div class="flex items-center justify-center gap-1">
              <For each={previewProviders}>
                {(provider) => {
                  const Icon = PROVIDER_ICONS[provider];
                  return (
                    <button
                      class="w-6 h-6 rounded-[var(--btn-radius)] flex items-center justify-center transition-colors"
                      classList={{
                        "bg-[color-mix(in_srgb,var(--accent)_20%,var(--bg-tertiary))] text-[var(--accent)]": expandedHoverProvider() === provider,
                        "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": expandedHoverProvider() !== provider,
                      }}
                      title={PROVIDER_LABELS[provider]}
                      onClick={() => setExpandedHoverProvider(provider)}
                    >
                      <Icon size={12} />
                    </button>
                  );
                }}
              </For>
              <button
                class="w-6 h-6 rounded-[var(--btn-radius)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => {
                  const ws = expandedHoverWorkspace();
                  if (!ws) return;
                  activateWorkspace(ws.id);
                  addTerminal(ws.path, buildNewSessionCommand(expandedHoverProvider()));
                  setExpandedHoverWorkspaceId(null);
                }}
                title={`New ${PROVIDER_LABELS[expandedHoverProvider()]} session`}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <path d="M8 3v10" />
                  <path d="M3 8h10" />
                </svg>
              </button>
              <button
                class="w-6 h-6 rounded-[var(--btn-radius)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => {
                  const ws = expandedHoverWorkspace();
                  if (!ws) return;
                  if (ws.id !== state.activeWorkspaceId) activateWorkspace(ws.id);
                  addTerminal(ws.path);
                  setExpandedHoverWorkspaceId(null);
                }}
                title="New terminal"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <path d="M3 4l4 4-4 4" />
                  <path d="M9 12h4" />
                </svg>
              </button>
            </div>
            <div class="flex items-center justify-center gap-1 mt-1">
              <button
                data-preview-tab="sessions"
                class="px-2 py-1 text-[10px] rounded-[var(--btn-radius)] transition-colors"
                classList={{
                  "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-tertiary))] text-[var(--text-primary)]": expandedHoverTab() === "sessions",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": expandedHoverTab() !== "sessions",
                }}
                onClick={() => setExpandedHoverTab("sessions")}
              >
                Sessions
              </button>
              <button
                data-preview-tab="all"
                class="px-2 py-1 text-[10px] rounded-[var(--btn-radius)] transition-colors inline-flex items-center gap-1"
                classList={{
                  "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-tertiary))] text-[var(--text-primary)]": expandedHoverTab() === "all",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": expandedHoverTab() !== "all",
                }}
                onClick={() => setExpandedHoverTab("all")}
              >
                <span>All {expandedHoverAllTerminals().length}</span>
                <Show when={expandedHoverAllAttentionCount() > 0}>
                  <span class="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
                </Show>
              </button>
              <button
                data-preview-tab="active"
                class="px-2 py-1 text-[10px] rounded-[var(--btn-radius)] transition-colors inline-flex items-center gap-1"
                classList={{
                  "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-tertiary))] text-[var(--text-primary)]": expandedHoverTab() === "active",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": expandedHoverTab() !== "active",
                }}
                onClick={() => setExpandedHoverTab("active")}
              >
                <span>Active {expandedHoverActiveTerminals().length}</span>
                <Show when={expandedHoverActiveAttentionCount() > 0}>
                  <span class="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
                </Show>
              </button>
              <button
                data-preview-tab="stashed"
                class="px-2 py-1 text-[10px] rounded-[var(--btn-radius)] transition-colors inline-flex items-center gap-1"
                classList={{
                  "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-tertiary))] text-[var(--text-primary)]": expandedHoverTab() === "stashed",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": expandedHoverTab() !== "stashed",
                }}
                onClick={() => setExpandedHoverTab("stashed")}
              >
                <span>Stashed {expandedHoverStashedTerminals().length}</span>
                <Show when={expandedHoverStashedAttentionCount() > 0}>
                  <span class="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
                </Show>
              </button>
            </div>
          </div>

          <div class="px-2 py-2 max-h-56 overflow-y-auto">
            <Show when={expandedHoverTab() === "all"}>
              <For
                each={expandedHoverAllTerminals()}
                fallback={<div class="text-xs text-[var(--text-secondary)] py-1">No terminals</div>}
              >
                {(terminal) => {
                  const Icon = terminal.provider ? PROVIDER_ICONS[terminal.provider] : undefined;
                  return (
                    <button
                      class="w-full text-left px-2 py-1.5 rounded-[var(--btn-radius)] text-xs mb-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-tertiary))]"
                      classList={{
                        "bg-[var(--bg-tertiary)]": terminal.id === state.activeTerminalId && !terminal.stashed && !terminal.needsAttention,
                        "opacity-50": terminal.stashed && !terminal.needsAttention,
                        "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]": !!terminal.needsAttention,
                      }}
                      onClick={() => activatePreviewTerminal(terminal)}
                    >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span
                          class="w-1.5 h-1.5 rounded-full shrink-0"
                          classList={{
                            "bg-[var(--warning)] animate-pulse": !!terminal.needsAttention,
                            "bg-[var(--success)]": !terminal.needsAttention && terminal.wsConnected && !terminal.stashed,
                            "bg-[var(--text-secondary)] opacity-40": !terminal.needsAttention && (!terminal.wsConnected || terminal.stashed),
                          }}
                        />
                        {Icon ? <Icon size={11} /> : null}
                        <span
                          class="truncate"
                          classList={{
                            "text-[var(--warning)]": !!terminal.needsAttention,
                            "text-[var(--text-primary)]": !terminal.needsAttention && !terminal.stashed,
                            "text-[var(--text-secondary)] italic": !terminal.needsAttention && terminal.stashed,
                          }}
                        >
                          {terminal.stashed ? "↑ " : ""}
                          {terminal.customTitle || terminal.sessionTitle || terminal.title || terminal.cwd.split("/").pop() || "terminal"}
                        </span>
                      </div>
                    </button>
                  );
                }}
              </For>
            </Show>

            <Show when={expandedHoverTab() === "sessions"}>
              <Show when={expandedHoverLoading()}>
                <div class="text-xs text-[var(--text-secondary)] py-1">Loading sessions...</div>
              </Show>
              <Show when={!expandedHoverLoading()}>
                <For
                  each={expandedHoverSessions()}
                  fallback={<div class="text-xs text-[var(--text-secondary)] py-1">No sessions found</div>}
                >
                  {(session) => {
                    const linkedTerminal = () => state.terminals.find((terminal) => terminal.sessionId === session.id);
                    return (
                      <button
                        class="w-full text-left px-2 py-1.5 rounded-[var(--btn-radius)] text-xs mb-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-tertiary))]"
                        classList={{
                          "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]": !!linkedTerminal()?.needsAttention,
                        }}
                        onClick={() => openPreviewSession(session)}
                      >
                        <div class="flex items-center gap-1.5 min-w-0">
                          <Show when={linkedTerminal()}>
                            <span
                              class="w-1.5 h-1.5 rounded-full shrink-0"
                              classList={{
                                "bg-[var(--warning)] animate-pulse": !!linkedTerminal()!.needsAttention,
                                "bg-[var(--warning)]": !linkedTerminal()!.needsAttention && linkedTerminal()!.stashed,
                                "bg-[var(--success)]": !linkedTerminal()!.needsAttention && !linkedTerminal()!.stashed,
                              }}
                            />
                          </Show>
                          <span class="truncate text-[var(--text-primary)]">- {session.title}</span>
                          <span class="ml-auto shrink-0 text-[10px] text-[var(--text-secondary)]">{session.messageCount} msgs</span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </Show>
            </Show>

            <Show when={expandedHoverTab() === "active"}>
              <For
                each={expandedHoverActiveTerminals()}
                fallback={<div class="text-xs text-[var(--text-secondary)] py-1">No active terminals</div>}
              >
                {(terminal) => {
                  const Icon = terminal.provider ? PROVIDER_ICONS[terminal.provider] : undefined;
                  return (
                    <button
                      class="w-full text-left px-2 py-1.5 rounded-[var(--btn-radius)] text-xs mb-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-tertiary))]"
                      classList={{
                        "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]": !!terminal.needsAttention,
                      }}
                      onClick={() => activatePreviewTerminal(terminal)}
                    >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" />
                        {Icon ? <Icon size={11} /> : null}
                        <span class="truncate text-[var(--text-primary)]">{terminal.customTitle || terminal.sessionTitle || terminal.title || "terminal"}</span>
                      </div>
                    </button>
                  );
                }}
              </For>
            </Show>

            <Show when={expandedHoverTab() === "stashed"}>
              <For
                each={expandedHoverStashedTerminals()}
                fallback={<div class="text-xs text-[var(--text-secondary)] py-1">No stashed terminals</div>}
              >
                {(terminal) => {
                  const Icon = terminal.provider ? PROVIDER_ICONS[terminal.provider] : undefined;
                  return (
                    <button
                      class="w-full text-left px-2 py-1.5 rounded-[var(--btn-radius)] text-xs mb-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-tertiary))]"
                      onClick={() => activatePreviewTerminal(terminal)}
                    >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0" />
                        {Icon ? <Icon size={11} /> : null}
                        <span class="truncate text-[var(--text-secondary)] italic">↑ {terminal.customTitle || terminal.sessionTitle || terminal.title || "terminal"}</span>
                      </div>
                    </button>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={!state.sidebarOpen && hovering()}>
        <div
          data-bord-sidebar-flyout
          class="absolute left-16 top-0 h-full z-40 border-x border-[var(--border)] shadow-[0_12px_30px_rgba(0,0,0,0.35)] popover-appear"
          onMouseEnter={openFlyout}
          onMouseLeave={closeFlyoutSoon}
        >
          {panel()}
        </div>
      </Show>

      <SettingsPanel open={settingsOpen()} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
