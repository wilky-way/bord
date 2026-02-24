import { createSignal, For, Show, onMount } from "solid-js";
import { api } from "../../lib/api";
import { getFileIcon } from "../../lib/file-icons";

interface DirEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink";
  size: number;
  modified: number;
  isHidden: boolean;
}

interface Props {
  rootPath: string;
  onFileOpen: (path: string) => void;
}

export default function FileTree(props: Props) {
  const [cache, setCache] = createSignal<Map<string, DirEntry[]>>(new Map());
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
  const [showHidden, setShowHidden] = createSignal(false);
  const [loading, setLoading] = createSignal<Set<string>>(new Set());

  async function fetchDir(path: string) {
    if (cache().has(path)) return;
    setLoading((prev) => { const s = new Set(prev); s.add(path); return s; });
    try {
      const result = await api.listDir(path);
      setCache((prev) => { const m = new Map(prev); m.set(path, result.entries); return m; });
    } catch (e) {
      console.error("Failed to list dir:", path, e);
    } finally {
      setLoading((prev) => { const s = new Set(prev); s.delete(path); return s; });
    }
  }

  function toggleExpanded(path: string) {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(path)) { s.delete(path); } else { s.add(path); }
      return s;
    });
    if (!cache().has(path)) fetchDir(path);
  }

  onMount(() => {
    fetchDir(props.rootPath);
  });

  function filteredEntries(entries: DirEntry[]): DirEntry[] {
    if (showHidden()) return entries;
    return entries.filter((e) => !e.isHidden);
  }

  function TreeNode(nodeProps: { entry: DirEntry; depth: number }) {
    const isDir = () => nodeProps.entry.type === "dir";
    const isExpanded = () => expanded().has(nodeProps.entry.path);
    const isLoading = () => loading().has(nodeProps.entry.path);
    const children = () => cache().get(nodeProps.entry.path);
    const icon = () => getFileIcon(nodeProps.entry.name, nodeProps.entry.type);

    return (
      <>
        <div
          class="flex items-center gap-1.5 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors group"
          style={{ "padding-left": `${nodeProps.depth * 16 + 8}px`, height: "28px" }}
          onClick={() => {
            if (isDir()) toggleExpanded(nodeProps.entry.path);
          }}
          onDblClick={() => {
            if (!isDir()) props.onFileOpen(nodeProps.entry.path);
          }}
        >
          {/* Chevron for dirs */}
          <Show when={isDir()}>
            <svg
              width="10" height="10" viewBox="0 0 16 16" fill="currentColor"
              class="shrink-0 text-[var(--text-secondary)] transition-transform"
              style={{ transform: isExpanded() ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
          </Show>
          <Show when={!isDir()}>
            <span class="w-[10px] shrink-0" />
          </Show>

          {/* File icon */}
          <span
            class="text-[10px] font-mono font-bold shrink-0 w-4 text-center leading-none"
            style={{ color: icon().color }}
          >
            {icon().icon}
          </span>

          {/* Name */}
          <span
            class="text-xs truncate"
            classList={{
              "text-[var(--text-primary)]": !nodeProps.entry.isHidden,
              "text-[var(--text-secondary)] opacity-60": nodeProps.entry.isHidden,
            }}
          >
            {nodeProps.entry.name}
          </span>

          {/* Loading spinner for dirs */}
          <Show when={isDir() && isLoading()}>
            <span class="text-[9px] text-[var(--text-secondary)] opacity-50 ml-auto mr-2">...</span>
          </Show>
        </div>

        {/* Children */}
        <Show when={isDir() && isExpanded() && children()}>
          <For each={filteredEntries(children()!)}>
            {(child) => <TreeNode entry={child} depth={nodeProps.depth + 1} />}
          </For>
        </Show>
      </>
    );
  }

  return (
    <div class="flex flex-col h-full bg-[var(--bg-primary)]" data-file-tree>
      {/* Toolbar */}
      <div class="flex items-center justify-between px-2 py-1 border-b border-[var(--border)] shrink-0" data-file-tree-toolbar>
        <span class="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Files</span>
        <button
          class="text-[10px] px-1.5 py-0.5 rounded-[var(--btn-radius)] transition-colors"
          classList={{
            "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]": showHidden(),
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": !showHidden(),
          }}
          onClick={() => setShowHidden((v) => !v)}
          title="Toggle hidden files"
        >
          .*
        </button>
      </div>

      {/* Tree content */}
      <div class="flex-1 min-h-0 overflow-y-auto">
        <Show
          when={cache().has(props.rootPath)}
          fallback={
            <div class="flex items-center justify-center py-8 text-xs text-[var(--text-secondary)]">
              Loading...
            </div>
          }
        >
          <For each={filteredEntries(cache().get(props.rootPath)!)}>
            {(entry) => <TreeNode entry={entry} depth={0} />}
          </For>
        </Show>
      </div>
    </div>
  );
}
