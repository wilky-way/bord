import { createSignal, createEffect, Show, For, onCleanup } from "solid-js";
import { api } from "../../lib/api";

interface RepoInfo {
  path: string;
  name: string;
  branch: string;
}

interface Props {
  cwd: string;
  effectiveCwd: string;
  onNavigate: (path: string) => void;
  onReset: () => void;
}

export default function RepoNavigator(props: Props) {
  const [parent, setParent] = createSignal<RepoInfo | null>(null);
  const [current, setCurrent] = createSignal<RepoInfo | null>(null);
  const [siblings, setSiblings] = createSignal<RepoInfo[]>([]);
  const [children, setChildren] = createSignal<RepoInfo[]>([]);
  const [open, setOpen] = createSignal(false);

  async function fetchTree() {
    try {
      const tree = await api.gitRepoTree(props.effectiveCwd);
      setCurrent(tree.current);
      setParent(tree.parent);
      setSiblings(tree.siblings);
      setChildren(tree.children);
    } catch {
      setCurrent(null);
      setParent(null);
      setSiblings([]);
      setChildren([]);
    }
  }

  createEffect(() => {
    props.effectiveCwd;
    fetchTree();
  });

  // Close dropdown on outside click
  let containerRef: HTMLDivElement | undefined;
  const handleClickOutside = (e: MouseEvent) => {
    if (open() && containerRef && !containerRef.contains(e.target as Node)) {
      setOpen(false);
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  }

  const hasDropdownItems = () => siblings().length > 0 || children().length > 0;
  const isOverridden = () => props.effectiveCwd !== props.cwd;

  return (
    <Show when={current()}>
      <div ref={containerRef} class="flex items-center gap-1 text-[10px] mb-1.5 min-w-0">
        {/* Parent breadcrumb */}
        <Show when={parent()}>
          <button
            class="text-[var(--text-secondary)] hover:text-[var(--accent)] truncate max-w-[80px] transition-colors"
            onClick={() => props.onNavigate(parent()!.path)}
            title={parent()!.path}
          >
            {parent()!.name}
          </button>
          <span class="text-[var(--text-secondary)]">/</span>
        </Show>

        {/* Current repo — opens dropdown if items exist */}
        <div class="relative">
          <button
            class="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium flex items-center gap-0.5 truncate max-w-[100px] transition-colors"
            onClick={() => hasDropdownItems() && setOpen(!open())}
            title={current()!.path}
          >
            {current()!.name}
            <Show when={hasDropdownItems()}>
              <span class="text-[8px]">▾</span>
            </Show>
          </button>

          {/* Dropdown: siblings + children */}
          <Show when={open()}>
            <div class="absolute top-full left-0 mt-1 z-50 min-w-[180px] max-h-[240px] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border)] rounded shadow-lg">
              <Show when={siblings().length > 0}>
                <div class="px-2 py-1 text-[9px] uppercase tracking-wider text-[var(--text-secondary)] font-medium border-b border-[var(--border)]">
                  Siblings
                </div>
                <For each={siblings()}>
                  {(repo) => (
                    <button
                      class="w-full text-left px-2 py-1 hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between gap-2"
                      onClick={() => { setOpen(false); props.onNavigate(repo.path); }}
                    >
                      <span class="text-[var(--text-primary)] truncate">{repo.name}</span>
                      <span class="text-[var(--text-secondary)] shrink-0">{repo.branch}</span>
                    </button>
                  )}
                </For>
              </Show>
              <Show when={children().length > 0}>
                <div class="px-2 py-1 text-[9px] uppercase tracking-wider text-[var(--text-secondary)] font-medium border-b border-[var(--border)]">
                  Children
                </div>
                <For each={children()}>
                  {(repo) => (
                    <button
                      class="w-full text-left px-2 py-1 hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between gap-2"
                      onClick={() => { setOpen(false); props.onNavigate(repo.path); }}
                    >
                      <span class="text-[var(--text-primary)] truncate">{repo.name}</span>
                      <span class="text-[var(--text-secondary)] shrink-0">{repo.branch}</span>
                    </button>
                  )}
                </For>
              </Show>
            </div>
          </Show>
        </div>

        {/* Reset button — only when navigated away */}
        <Show when={isOverridden()}>
          <button
            class="text-[var(--warning)] hover:text-[var(--danger)] ml-1 w-4 h-4 flex items-center justify-center transition-colors"
            onClick={props.onReset}
            title="Return to terminal's repo"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
              <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 1 1 .908-.418A6 6 0 1 1 8 2v1z" />
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
            </svg>
          </button>
        </Show>
      </div>
    </Show>
  );
}
