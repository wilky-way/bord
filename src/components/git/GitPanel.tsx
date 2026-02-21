import { createSignal, onMount, onCleanup, Show, For, createEffect } from "solid-js";
import { api } from "../../lib/api";
import { getPreferredEditor } from "../../lib/editor-preference";
import ChangedFilesList from "./ChangedFilesList";
import DiffViewer from "./DiffViewer";
import CommitInput from "./CommitInput";
import RepoNavigator from "./RepoNavigator";
import type { GitStatus } from "../../store/types";

interface GitPanelProps {
  cwd: string;
  onClose?: () => void;
}

export default function GitPanel(props: GitPanelProps) {
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
  const [overrideCwd, setOverrideCwd] = createSignal<string | null>(null);
  const [fileStats, setFileStats] = createSignal<{
    staged: Record<string, { insertions: number; deletions: number }>;
    unstaged: Record<string, { insertions: number; deletions: number }>;
  } | null>(null);
  const effectiveCwd = () => overrideCwd() || props.cwd;

  // Clear selections when navigating to a different repo
  createEffect(() => {
    effectiveCwd();
    setSelectedFile(null);
    setSelectedDiff("");
  });

  async function refresh() {
    const cwd = effectiveCwd();
    if (!cwd) return;
    try {
      const [status, ab, perFileStats] = await Promise.all([
        api.gitStatus(cwd),
        api.gitAheadBehind(cwd),
        api.gitDiffStatsPerFile(cwd),
      ]);
      setGitStatus(status);
      setAhead(ab.ahead);
      setBehind(ab.behind);
      setFileStats(perFileStats);
    } catch {
      setGitStatus(null);
      setAhead(0);
      setBehind(0);
      setFileStats(null);
    }
  }

  async function fetchAndRefresh() {
    const cwd = effectiveCwd();
    if (!cwd) return;
    try {
      await api.gitFetch(cwd);
    } catch {
      // fire-and-forget
    }
    refresh();
  }

  // Re-fetch when effective cwd changes
  createEffect(() => {
    effectiveCwd();
    refresh();
  });

  let refreshInterval: ReturnType<typeof setInterval>;
  let fetchInterval: ReturnType<typeof setInterval>;
  onMount(() => {
    fetchAndRefresh();
    refreshInterval = setInterval(refresh, 5000);
    fetchInterval = setInterval(fetchAndRefresh, 30000);
  });
  onCleanup(() => {
    clearInterval(refreshInterval);
    clearInterval(fetchInterval);
  });

  async function viewDiff(file: string, staged: boolean) {
    const cwd = effectiveCwd();
    if (!cwd) return;
    setSelectedFile(file);
    const result = await api.gitDiff(cwd, { file, staged });
    setSelectedDiff(result.diff);
  }

  async function stageFile(file: string) {
    const cwd = effectiveCwd();
    if (!cwd) return;
    await api.gitStage(cwd, file);
    refresh();
  }

  async function unstageFile(file: string) {
    const cwd = effectiveCwd();
    if (!cwd) return;
    await api.gitUnstage(cwd, file);
    refresh();
  }

  async function stageAll() {
    const cwd = effectiveCwd();
    if (!cwd) return;
    await api.gitStageAll(cwd);
    refresh();
  }

  async function unstageAll() {
    const cwd = effectiveCwd();
    if (!cwd) return;
    await api.gitUnstageAll(cwd);
    refresh();
  }

  async function commit(message: string) {
    const cwd = effectiveCwd();
    if (!cwd) return;
    const result = await api.gitCommit(cwd, message);
    if (result.ok) refresh();
  }

  async function handlePush() {
    const cwd = effectiveCwd();
    if (!cwd || pushing()) return;
    setPushing(true);
    try {
      const result = await api.gitPush(cwd);
      if (result.ok) {
        setPushDone(true);
        setAhead(0);
        setTimeout(() => setPushDone(false), 2000);
      }
    } finally {
      setPushing(false);
    }
  }

  async function handlePull() {
    const cwd = effectiveCwd();
    if (!cwd || pulling()) return;
    setPulling(true);
    try {
      const result = await api.gitPull(cwd);
      if (result.ok) {
        setPullDone(true);
        setBehind(0);
        setTimeout(() => setPullDone(false), 2000);
        refresh();
      }
    } finally {
      setPulling(false);
    }
  }

  async function loadBranches() {
    const cwd = effectiveCwd();
    if (!cwd) return;
    try {
      const result = await api.gitBranches(cwd);
      setBranches(result.branches);
    } catch {
      setBranches([]);
    }
  }

  async function switchBranch(branch: string) {
    const cwd = effectiveCwd();
    if (!cwd) return;
    setShowBranchDropdown(false);
    await api.gitCheckout(cwd, branch);
    refresh();
  }

  function openFile(file: string) {
    const cwd = effectiveCwd();
    if (!cwd) return;
    api.openInEditor(cwd, getPreferredEditor(), file);
  }

  function toggleBranchDropdown() {
    if (!showBranchDropdown()) {
      loadBranches();
    }
    setShowBranchDropdown(!showBranchDropdown());
  }

  return (
    <div class="p-2 flex flex-col h-full">
      <RepoNavigator
        cwd={props.cwd}
        effectiveCwd={effectiveCwd()}
        onNavigate={(path) => setOverrideCwd(path)}
        onReset={() => setOverrideCwd(null)}
      />

      {/* SOURCE CONTROL label row */}
      <div class="flex items-center justify-between mb-1">
        <span class="text-[10px] uppercase tracking-wider font-medium text-[var(--text-secondary)]">Source Control</span>
        <div class="flex items-center gap-1">
          <button
            class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] w-5 h-5 flex items-center justify-center rounded-[var(--btn-radius)] hover:bg-[var(--bg-tertiary)] transition-colors"
            onClick={refresh}
            title="Refresh"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
              <path fill-rule="evenodd" d="M13.836 2.477a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1h1.82a5.5 5.5 0 1 0 1.152 3.848.5.5 0 1 1 .998.074A6.5 6.5 0 1 1 12.2 3.1l1.636-1.123z" />
            </svg>
          </button>
          <Show when={props.onClose}>
            <button
              class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] w-5 h-5 flex items-center justify-center rounded-[var(--btn-radius)] hover:bg-[var(--bg-tertiary)] transition-colors"
              onClick={props.onClose}
              title="Close git panel"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
                <path fill-rule="evenodd" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </Show>
        </div>
      </div>

      {/* Branch row with sync badges */}
      <Show when={gitStatus()}>
        <div class="flex items-center gap-2 mb-2">
          {/* Branch selector */}
          <div class="relative">
            <button
              class="text-xs text-[var(--text-primary)] hover:text-[var(--accent)] flex items-center gap-1 transition-colors"
              onClick={toggleBranchDropdown}
              title="Switch branch"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5 shrink-0 text-[var(--text-secondary)]">
                <path fill-rule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
              </svg>
              <span class="truncate max-w-[120px]">{gitStatus()!.branch}</span>
              <span class="text-[8px] text-[var(--text-secondary)]">▾</span>
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

          {/* Sync badges */}
          <div class="flex items-center gap-1.5 ml-auto">
            {/* Pull badge */}
            <button
              class="text-[11px] font-mono px-1 py-0.5 rounded transition-all min-w-[28px] text-center"
              classList={{
                "text-[var(--warning)] hover:bg-[var(--warning)]/15 cursor-pointer": behind() > 0 && !pulling() && !pullDone(),
                "text-[var(--text-secondary)]/40": behind() === 0 && !pulling() && !pullDone(),
                "text-[var(--success)]": pullDone(),
              }}
              onClick={handlePull}
              disabled={pulling()}
              title={behind() > 0 ? `Pull ${behind()} commit${behind() > 1 ? "s" : ""}` : "Nothing to pull"}
            >
              {pulling() ? (
                <svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 inline animate-spin">
                  <path d="M8 1a7 7 0 0 0-7 7h2a5 5 0 0 1 5-5V1z" />
                </svg>
              ) : (
                <>↓{behind()}</>
              )}
            </button>
            {/* Push badge */}
            <button
              class="text-[11px] font-mono px-1 py-0.5 rounded transition-all min-w-[28px] text-center"
              classList={{
                "text-[var(--accent)] hover:bg-[var(--accent)]/15 cursor-pointer": ahead() > 0 && !pushing() && !pushDone(),
                "text-[var(--text-secondary)]/40": ahead() === 0 && !pushing() && !pushDone(),
                "text-[var(--success)]": pushDone(),
              }}
              onClick={handlePush}
              disabled={pushing()}
              title={ahead() > 0 ? `Push ${ahead()} commit${ahead() > 1 ? "s" : ""}` : "Nothing to push"}
            >
              {pushing() ? (
                <svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 inline animate-spin">
                  <path d="M8 1a7 7 0 0 0-7 7h2a5 5 0 0 1 5-5V1z" />
                </svg>
              ) : (
                <>↑{ahead()}</>
              )}
            </button>
          </div>
        </div>
      </Show>

      <Show when={gitStatus()}>
        <div class="flex-1 min-h-0 overflow-y-auto space-y-2">
          <ChangedFilesList
            status={gitStatus()!}
            cwd={effectiveCwd()}
            fileStats={fileStats()}
            onViewDiff={viewDiff}
            onStage={stageFile}
            onUnstage={unstageFile}
            onStageAll={stageAll}
            onUnstageAll={unstageAll}
            onOpenFile={openFile}
          />

          <Show when={selectedFile()}>
            <DiffViewer diff={selectedDiff()} fileName={selectedFile()!} cwd={effectiveCwd()} />
          </Show>
        </div>

        <div class="shrink-0 pt-2">
          <CommitInput onCommit={commit} />
        </div>
      </Show>
    </div>
  );
}
