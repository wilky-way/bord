import { createSignal, onMount, onCleanup, Show, For, createEffect } from "solid-js";
import { state } from "../../store/core";
import { api } from "../../lib/api";
import ChangedFilesList from "./ChangedFilesList";
import DiffViewer from "./DiffViewer";
import CommitInput from "./CommitInput";
import type { GitStatus } from "../../store/types";

export default function GitPanel() {
  const [gitStatus, setGitStatus] = createSignal<GitStatus | null>(null);
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [selectedDiff, setSelectedDiff] = createSignal("");
  const [ahead, setAhead] = createSignal(0);
  const [behind, setBehind] = createSignal(0);
  const [pushing, setPushing] = createSignal(false);
  const [pushDone, setPushDone] = createSignal(false);
  const [pulling, setPulling] = createSignal(false);
  const [pullDone, setPullDone] = createSignal(false);
  const [branches, setBranches] = createSignal<string[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = createSignal(false);

  const activeCwd = () => {
    // First: active workspace
    const ws = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    if (ws?.path) return ws.path;
    // Fallback: active terminal's cwd
    const term = state.terminals.find((t) => t.id === state.activeTerminalId);
    return term?.cwd ?? null;
  };

  async function refresh() {
    const cwd = activeCwd();
    if (!cwd) return;
    try {
      const [status, ab] = await Promise.all([
        api.gitStatus(cwd),
        api.gitAheadBehind(cwd),
      ]);
      setGitStatus(status);
      setAhead(ab.ahead);
      setBehind(ab.behind);
    } catch {
      setGitStatus(null);
      setAhead(0);
      setBehind(0);
    }
  }

  // Re-fetch when active terminal changes
  createEffect(() => {
    // Track reactive dependencies
    state.activeTerminalId;
    state.activeWorkspaceId;
    refresh();
  });

  let interval: ReturnType<typeof setInterval>;
  onMount(() => {
    refresh();
    interval = setInterval(refresh, 5000);
  });
  onCleanup(() => clearInterval(interval));

  async function viewDiff(file: string, staged: boolean) {
    const cwd = activeCwd();
    if (!cwd) return;
    setSelectedFile(file);
    const result = await api.gitDiff(cwd, { file, staged });
    setSelectedDiff(result.diff);
  }

  async function stageFile(file: string) {
    const cwd = activeCwd();
    if (!cwd) return;
    await api.gitStage(cwd, file);
    refresh();
  }

  async function unstageFile(file: string) {
    const cwd = activeCwd();
    if (!cwd) return;
    await api.gitUnstage(cwd, file);
    refresh();
  }

  async function stageAll() {
    const cwd = activeCwd();
    if (!cwd) return;
    await api.gitStageAll(cwd);
    refresh();
  }

  async function unstageAll() {
    const cwd = activeCwd();
    if (!cwd) return;
    await api.gitUnstageAll(cwd);
    refresh();
  }

  async function commit(message: string) {
    const cwd = activeCwd();
    if (!cwd) return;
    const result = await api.gitCommit(cwd, message);
    if (result.ok) refresh();
  }

  async function handlePush() {
    const cwd = activeCwd();
    if (!cwd) return;
    setPushing(true);
    try {
      const result = await api.gitPush(cwd);
      if (result.ok) {
        setPushDone(true);
        setAhead(0);
        setTimeout(() => setPushDone(false), 3000);
      }
    } finally {
      setPushing(false);
    }
  }

  async function handlePull() {
    const cwd = activeCwd();
    if (!cwd) return;
    setPulling(true);
    try {
      const result = await api.gitPull(cwd);
      if (result.ok) {
        setPullDone(true);
        setBehind(0);
        setTimeout(() => setPullDone(false), 3000);
        refresh();
      }
    } finally {
      setPulling(false);
    }
  }

  async function loadBranches() {
    const cwd = activeCwd();
    if (!cwd) return;
    try {
      const result = await api.gitBranches(cwd);
      setBranches(result.branches);
    } catch {
      setBranches([]);
    }
  }

  async function switchBranch(branch: string) {
    const cwd = activeCwd();
    if (!cwd) return;
    setShowBranchDropdown(false);
    await api.gitCheckout(cwd, branch);
    refresh();
  }

  function toggleBranchDropdown() {
    if (!showBranchDropdown()) {
      loadBranches();
    }
    setShowBranchDropdown(!showBranchDropdown());
  }

  return (
    <div class="p-2 flex flex-col h-full">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Git</span>
          <Show when={gitStatus()}>
            {/* Clickable branch name - opens branch switcher */}
            <div class="relative">
              <button
                class="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-0.5"
                onClick={toggleBranchDropdown}
                title="Switch branch"
              >
                {gitStatus()!.branch}
                <span class="text-[8px]">▾</span>
              </button>

              {/* Branch dropdown */}
              <Show when={showBranchDropdown()}>
                <div
                  class="absolute top-full left-0 mt-1 z-50 min-w-[160px] max-h-[200px] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border)] rounded shadow-lg"
                >
                  <For each={branches()}>
                    {(b) => (
                      <button
                        class="w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
                        classList={{
                          "text-[var(--accent)] font-medium": b === gitStatus()!.branch,
                          "text-[var(--text-primary)]": b !== gitStatus()!.branch,
                        }}
                        onClick={() => switchBranch(b)}
                      >
                        {b === gitStatus()!.branch ? `● ${b}` : b}
                      </button>
                    )}
                  </For>
                  <Show when={branches().length === 0}>
                    <div class="text-xs text-[var(--text-secondary)] px-3 py-2">No branches</div>
                  </Show>
                </div>
              </Show>
            </div>

            {/* Ahead/behind badges */}
            <Show when={ahead() > 0}>
              <span class="text-[10px] text-[var(--accent)]" title={`${ahead()} ahead`}>↑{ahead()}</span>
            </Show>
            <Show when={behind() > 0}>
              <span class="text-[10px] text-[var(--warning)]" title={`${behind()} behind`}>↓{behind()}</span>
            </Show>
          </Show>
        </div>
        <button
          class="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
          onClick={refresh}
        >
          Refresh
        </button>
      </div>

      <Show when={!activeCwd()}>
        <div class="text-xs text-[var(--text-secondary)] py-4 text-center">Select a workspace or terminal to view git status</div>
      </Show>

      <Show when={activeCwd() && gitStatus()}>
        <div class="flex-1 overflow-y-auto space-y-2">
          <ChangedFilesList
            status={gitStatus()!}
            onViewDiff={viewDiff}
            onStage={stageFile}
            onUnstage={unstageFile}
            onStageAll={stageAll}
            onUnstageAll={unstageAll}
          />

          <Show when={selectedFile()}>
            <DiffViewer diff={selectedDiff()} fileName={selectedFile()!} />
          </Show>

          <CommitInput onCommit={commit} />

          {/* Push / Pull buttons */}
          <div class="flex gap-2 pt-1 border-t border-[var(--border)]">
            <button
              class="flex-1 px-2 py-1 text-xs rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              classList={{
                "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)]": !pullDone(),
                "bg-[var(--success)] text-black": pullDone(),
              }}
              onClick={handlePull}
              disabled={pulling()}
            >
              {pulling() ? "Pulling..." : pullDone() ? "✓ Pulled" : `↓ Pull${behind() > 0 ? ` (${behind()})` : ""}`}
            </button>
            <button
              class="flex-1 px-2 py-1 text-xs rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              classList={{
                "bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)]": ahead() > 0 && !pushDone(),
                "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)]": ahead() === 0 && !pushDone(),
                "bg-[var(--success)] text-black": pushDone(),
              }}
              onClick={handlePush}
              disabled={pushing()}
            >
              {pushing() ? "Pushing..." : pushDone() ? "✓ Pushed" : `↑ Push${ahead() > 0 ? ` (${ahead()})` : ""}`}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
