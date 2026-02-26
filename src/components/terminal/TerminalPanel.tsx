import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { Portal, Dynamic } from "solid-js/web";
import TerminalView from "./TerminalView";
import { removeTerminal, setActiveTerminal, stashTerminal, setTerminalTitle, setTerminalMuted, setTerminalOscTitle, setTerminalDynamicCwd, setTerminalView, openFileInTerminal } from "../../store/terminals";
import { state } from "../../store/core";
import { toggleGitPanel, closeGitPanel } from "../../store/git";
import { PROVIDER_ICONS } from "../../lib/providers";
import WarmupIndicator from "./WarmupIndicator";
import EditorButton from "../shared/EditorButton";
import GitPanel from "../git/GitPanel";
import FileTree from "../files/FileTree";
import FileViewer from "../files/FileViewer";
import { api } from "../../lib/api";
import { isFeatureEnabled } from "../../store/features";
import { getFileOpenTarget, getPreferredEditor } from "../../lib/editor-preference";
import { sendToTerminal } from "../../lib/ws";
import { buildCdCommand, isPathWithinRoot } from "../../lib/workspace-paths";

interface Props {
  id: string;
  cwd: string;
  isActive: boolean;
  onDragStart?: (e: PointerEvent) => void;
}

export default function TerminalPanel(props: Props) {
  let panelRef: HTMLDivElement | undefined;
  const [title, setTitle] = createSignal(props.cwd.split("/").pop() ?? "terminal");
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const terminal = () => state.terminals.find((t) => t.id === props.id);
  const effectiveCwd = () => terminal()?.dynamicCwd ?? props.cwd;
  const terminalView = () => terminal()?.terminalView ?? "terminal";
  const workspaceName = () => state.workspaces.find((w) => w.id === terminal()?.workspaceId)?.name;
  const workspacePath = () => state.workspaces.find((w) => w.id === terminal()?.workspaceId)?.path;
  const isOutsideWorkspace = () => {
    const workspaceRoot = workspacePath();
    const cwd = effectiveCwd();
    if (!workspaceRoot || !cwd) return false;
    return !isPathWithinRoot(workspaceRoot, cwd);
  };
  const displayTitle = () => terminal()?.customTitle || terminal()?.sessionTitle || title();
  const [branch, setBranch] = createSignal<string | null>(null);
  const [dirty, setDirty] = createSignal(false);
  const [ahead, setAhead] = createSignal(0);
  const [pushing, setPushing] = createSignal(false);
  const [pushDone, setPushDone] = createSignal(false);
  const [insertions, setInsertions] = createSignal(0);
  const [deletions, setDeletions] = createSignal(0);
  const [returningHome, setReturningHome] = createSignal(false);
  const isGitPanelOpen = () => state.gitPanelTerminalId === props.id;
  let returnHomeTimer: ReturnType<typeof setTimeout> | undefined;

  let branchButtonRef: HTMLButtonElement | undefined;
  let popoverRef: HTMLDivElement | undefined;
  const [popoverPos, setPopoverPos] = createSignal({ top: 0, left: 0 });

  // Resizable popover state
  const [popoverWidth, setPopoverWidth] = createSignal(380);
  const [resizing, setResizing] = createSignal<"left" | "right" | null>(null);
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  let resizeStartLeft = 0;

  function updatePopoverPosition() {
    if (!branchButtonRef) return;
    const rect = branchButtonRef.getBoundingClientRect();
    const w = popoverWidth();
    let top = rect.bottom + 4;
    let left = rect.left;
    // Clamp to viewport edges
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (left < 8) left = 8;
    if (top > window.innerHeight - 100) {
      top = rect.top - 4;
    }
    setPopoverPos({ top, left });
  }

  // Reposition popover when open
  createEffect(() => {
    if (!isGitPanelOpen()) return;
    updatePopoverPosition();
    const h = () => updatePopoverPosition();
    window.addEventListener("resize", h);
    window.addEventListener("scroll", h, true);
    onCleanup(() => {
      window.removeEventListener("resize", h);
      window.removeEventListener("scroll", h, true);
    });
  });

  // Click-outside to close
  createEffect(() => {
    if (!isGitPanelOpen()) return;
    const handler = (e: MouseEvent) => {
      if (resizing()) return; // Don't close while resizing
      const t = e.target as Node;
      if (popoverRef && !popoverRef.contains(t) && branchButtonRef && !branchButtonRef.contains(t)) {
        closeGitPanel();
      }
    };
    requestAnimationFrame(() => document.addEventListener("mousedown", handler));
    onCleanup(() => document.removeEventListener("mousedown", handler));
  });

  // Popover resize handlers
  function onResizeStart(side: "left" | "right", e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    setResizing(side);
    resizeStartX = e.clientX;
    resizeStartWidth = popoverWidth();
    resizeStartLeft = popoverPos().left;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - resizeStartX;
      const minW = 280;
      const maxW = window.innerWidth * 0.9;
      if (side === "right") {
        setPopoverWidth(Math.max(minW, Math.min(maxW, resizeStartWidth + delta)));
      } else {
        const newWidth = Math.max(minW, Math.min(maxW, resizeStartWidth - delta));
        const newLeft = resizeStartLeft + (resizeStartWidth - newWidth);
        setPopoverWidth(newWidth);
        setPopoverPos((prev) => ({ ...prev, left: Math.max(8, newLeft) }));
      }
    };
    const onUp = () => {
      setResizing(null);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  async function fetchGitInfo() {
    try {
      const cwd = effectiveCwd();
      const [status, ab, stats] = await Promise.all([
        api.gitStatus(cwd),
        api.gitAheadBehind(cwd),
        api.gitDiffStats(cwd),
      ]);
      setBranch(status.branch || null);
      setDirty(status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0);
      setAhead(ab.ahead);
      setInsertions(stats.insertions);
      setDeletions(stats.deletions);
    } catch {
      setBranch(null);
      setDirty(false);
      setAhead(0);
      setInsertions(0);
      setDeletions(0);
    }
  }

  let interval: ReturnType<typeof setInterval>;
  onMount(() => {
    fetchGitInfo();
    interval = setInterval(() => {
      if (state.activeWorkspaceId && terminal()?.workspaceId !== state.activeWorkspaceId) return;
      fetchGitInfo();
    }, 10_000);
    if (props.isActive && panelRef?.offsetParent !== null) {
      panelRef.scrollIntoView({ inline: "nearest", behavior: "instant" });
    }
  });
  onCleanup(() => clearInterval(interval));
  onCleanup(() => {
    if (returnHomeTimer) clearTimeout(returnHomeTimer);
  });

  // Re-fetch git info when CWD changes (debounced to avoid spam during rapid cd)
  let cwdDebounce: ReturnType<typeof setTimeout>;
  createEffect(() => {
    const _cwd = effectiveCwd(); // track dependency
    clearTimeout(cwdDebounce);
    cwdDebounce = setTimeout(() => {
      fetchGitInfo();
      // Restart the polling interval so we don't double-fetch
      clearInterval(interval);
      interval = setInterval(() => {
        if (state.activeWorkspaceId && terminal()?.workspaceId !== state.activeWorkspaceId) return;
        fetchGitInfo();
      }, 10_000);
    }, 300);
  });
  onCleanup(() => clearTimeout(cwdDebounce));

  createEffect(() => {
    if (props.isActive && panelRef?.offsetParent !== null) {
      panelRef.scrollIntoView({ inline: "nearest", behavior: "instant" });
    }
  });

  // Re-fetch git info immediately when workspace becomes active
  createEffect(() => {
    const wsId = state.activeWorkspaceId;
    const termWs = terminal()?.workspaceId;
    if (wsId && termWs === wsId) {
      fetchGitInfo();
    }
  });

  createEffect(() => {
    if (!returningHome()) return;
    if (!isOutsideWorkspace()) {
      setReturningHome(false);
      if (returnHomeTimer) clearTimeout(returnHomeTimer);
    }
  });

  async function handlePush() {
    setPushing(true);
    try {
      const result = await api.gitPush(effectiveCwd());
      if (result.ok) {
        setPushDone(true);
        setAhead(0);
        setTimeout(() => setPushDone(false), 3000);
      }
    } finally {
      setPushing(false);
    }
  }

  function openPath(path: string) {
    if (getFileOpenTarget() === "editor") {
      void api.openInEditor(effectiveCwd(), getPreferredEditor(), path).catch((err) => {
        console.error("[bord] open file in editor failed:", err);
      });
      return;
    }

    openFileInTerminal(props.id, path);
  }

  function returnToWorkspace() {
    const workspaceRoot = workspacePath();
    if (!workspaceRoot) return;

    setReturningHome(true);
    sendToTerminal(props.id, buildCdCommand(workspaceRoot));

    if (returnHomeTimer) clearTimeout(returnHomeTimer);
    returnHomeTimer = setTimeout(() => {
      setReturningHome(false);
    }, 5000);
  }

  return (
    <div
      ref={panelRef}
      data-terminal-id={props.id}
      data-provider={terminal()?.provider ?? ""}
      class="flex flex-col h-full min-w-0 bg-[var(--bg-secondary)] rounded-xl overflow-hidden"
      style={{
        "box-shadow": props.isActive ? "var(--shadow-glow)" : "var(--shadow-soft)",
        opacity: props.isActive ? 1 : 0.88,
        transition: "box-shadow 0.16s ease, opacity 0.16s ease",
      }}
      onMouseDown={() => setActiveTerminal(props.id)}
    >
      {/* Title bar */}
      <div
        data-titlebar
        class="flex items-center justify-between h-9 px-2.5 border-b border-[var(--border)] select-none shrink-0 cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => props.onDragStart?.(e)}
      >
        <div class="flex items-center gap-2 min-w-0 overflow-hidden flex-1">
          {/* Branch badge + dirty indicator — clickable to toggle git panel */}
          <Show when={isFeatureEnabled("git") && branch()}>
            <button
              ref={branchButtonRef}
              class="flex items-center gap-1 shrink-0 rounded-[var(--btn-radius)] px-1 py-0.5 transition-colors"
              classList={{
                "bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]": isGitPanelOpen(),
                "hover:bg-[var(--bg-tertiary)]": !isGitPanelOpen(),
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleGitPanel(props.id);
              }}
              title="Toggle git panel"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                classList={{
                  "bg-[var(--success)]": !dirty(),
                  "bg-[var(--warning)]": dirty(),
                }}
              />
              <span class="text-[10px] font-mono text-[var(--accent)]">{branch()}</span>
              <Show when={insertions() > 0 || deletions() > 0}>
                <span class="text-[9px] font-mono text-[var(--success)]">+{insertions()}</span>
                <span class="text-[9px] font-mono text-[var(--danger)]">-{deletions()}</span>
              </Show>
            </button>
          </Show>
          <Show when={!editing()} fallback={
            <input
              class="bg-transparent text-[var(--text-primary)] text-xs outline-none border-b border-[var(--accent)] w-24"
              value={editValue()}
              onInput={(e) => setEditValue(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setTerminalTitle(props.id, editValue()); setEditing(false); }
                if (e.key === "Escape") { setEditValue(displayTitle()); setEditing(false); }
              }}
              onBlur={() => { setTerminalTitle(props.id, editValue()); setEditing(false); }}
              autofocus
            />
          }>
            <Show when={terminal()?.provider}>
              <span class="shrink-0 mr-0.5 flex items-center">
                <Dynamic component={PROVIDER_ICONS[terminal()!.provider!]} size={11} />
              </span>
            </Show>
            <span
              class="text-xs text-[var(--text-secondary)] truncate cursor-text"
              onDblClick={() => { setEditValue(displayTitle()); setEditing(true); }}
            >
              {displayTitle()}
            </span>
          </Show>
          <Show when={workspaceName()}>
            <span class="text-[9px] text-[var(--text-secondary)] opacity-40 uppercase tracking-wider truncate">{workspaceName()}</span>
          </Show>
          <span class="text-[10px] text-[var(--text-secondary)] opacity-50 truncate">
            {effectiveCwd()}
          </span>
          <Show when={isOutsideWorkspace()}>
            <button
              class="text-[10px] px-1.5 py-0.5 rounded-[var(--btn-radius)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              classList={{
                "text-[var(--accent)] border-[var(--accent)]": returningHome(),
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                returnToWorkspace();
              }}
              title={`Return to workspace root: ${workspacePath()}`}
            >
              {returningHome() ? "Returning..." : "Return"}
            </button>
          </Show>
          <WarmupIndicator
            armed={!!terminal()?.notificationsArmed}
            warmupStartedAt={terminal()?.notificationWarmupStartedAt}
            muted={!!terminal()?.muted}
            globalMuted={state.bellMuted}
            onMuteToggle={() => setTerminalMuted(props.id, !terminal()?.muted)}
          />
        </div>
        <div class="flex items-center gap-1 shrink-0">
          {/* File tree toggle */}
          <button
            class="text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs w-6 h-6 flex items-center justify-center rounded-[var(--btn-radius)] hover:bg-[var(--bg-tertiary)] transition-colors"
            classList={{
              "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]": terminalView() === "filetree" || terminalView() === "file",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setTerminalView(props.id, terminalView() === "terminal" ? "filetree" : "terminal");
            }}
            title="File tree"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1h5l1 2H14.5a1 1 0 011 1v9a1 1 0 01-1 1h-13a1 1 0 01-1-1V2a1 1 0 011-1z" />
            </svg>
          </button>
          {/* Push button - shows when ahead > 0 */}
          <Show when={ahead() > 0 || pushing() || pushDone()}>
            <button
              class="text-[10px] px-1.5 py-0.5 rounded-[var(--btn-radius)] transition-colors"
              classList={{
                "text-[var(--accent)] hover:bg-[var(--bg-tertiary)]": !pushing() && !pushDone(),
                "text-[var(--text-secondary)] cursor-wait": pushing(),
                "text-[var(--success)]": pushDone(),
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!pushing() && !pushDone()) handlePush();
              }}
              disabled={pushing()}
              title={pushing() ? "Pushing..." : pushDone() ? "Pushed!" : `Push (${ahead()} ahead)`}
            >
              {pushing() ? "..." : pushDone() ? "ok" : `${ahead()}`}
            </button>
          </Show>
          <EditorButton cwd={effectiveCwd()} size="md" />
          <button
            data-action="stash-terminal"
            class="text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs w-6 h-6 flex items-center justify-center rounded-[var(--btn-radius)] hover:bg-[var(--bg-tertiary)] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              stashTerminal(props.id);
            }}
            title="Stash terminal"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          <button
            data-action="close-terminal"
            class="text-[var(--text-secondary)] hover:text-[var(--danger)] text-xs w-6 h-6 flex items-center justify-center rounded-[var(--btn-radius)] hover:bg-[var(--bg-tertiary)] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              removeTerminal(props.id);
            }}
          >
            x
          </button>
        </div>
      </div>

      {/* Content area — conditional on view mode */}
      <div class="flex-1 min-h-0 overflow-hidden relative">
        {/* TerminalView uses CSS hide to preserve ghostty-web WASM state */}
        <div class={terminalView() === "terminal" ? "contents" : "hidden"}>
          <TerminalView
            ptyId={props.id}
            isActive={props.isActive}
            onTitleChange={(newTitle: string) => {
              setTitle(newTitle);
              setTerminalOscTitle(props.id, newTitle);
            }}
            onCwdChange={(newCwd: string) => {
              setTerminalDynamicCwd(props.id, newCwd);
            }}
            onFileLinkOpen={(path: string) => {
              openPath(path);
            }}
            getCwd={() => effectiveCwd()}
          />
        </div>
        <Show when={terminalView() === "filetree"}>
          <FileTree
            rootPath={effectiveCwd()}
            onFileOpen={(path) => openPath(path)}
          />
        </Show>
        <Show when={terminalView() === "file"}>
          <FileViewer terminalId={props.id} />
        </Show>
      </div>

      {/* Git popover via Portal — hidden when terminal's workspace is not active */}
      <Show when={isFeatureEnabled("git") && isGitPanelOpen() && (!state.activeWorkspaceId || terminal()?.workspaceId === state.activeWorkspaceId)}>
        <Portal>
          <div
            ref={popoverRef}
            data-git-panel
            class="fixed z-[9999]"
            style={{ top: `${popoverPos().top}px`, left: `${popoverPos().left}px`, width: `${popoverWidth()}px` }}
          >
            <div
              class="relative bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-hidden popover-appear"
              style={{
                "box-shadow": "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
              }}
            >
              {/* Left resize handle */}
              <div
                class="absolute top-0 left-0 w-[6px] h-full z-20 cursor-col-resize group/resize"
                onPointerDown={(e) => onResizeStart("left", e)}
              >
                <div class="absolute top-0 left-[2px] w-[2px] h-full opacity-0 group-hover/resize:opacity-100 bg-[var(--accent)] transition-opacity" />
              </div>
              {/* Right resize handle */}
              <div
                class="absolute top-0 right-0 w-[6px] h-full z-20 cursor-col-resize group/resize"
                onPointerDown={(e) => onResizeStart("right", e)}
              >
                <div class="absolute top-0 right-[2px] w-[2px] h-full opacity-0 group-hover/resize:opacity-100 bg-[var(--accent)] transition-opacity" />
              </div>
              <div class="flex flex-col" style={{ "max-height": "calc(100vh - 60px)" }}>
                <GitPanel cwd={effectiveCwd()} onClose={() => closeGitPanel()} onOpenFile={(path) => openPath(path)} />
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
}
