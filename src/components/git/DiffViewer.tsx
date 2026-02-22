import { For, Show, createSignal, createMemo, createEffect } from "solid-js";
import OpenFileButton from "../shared/OpenFileButton";

interface Props {
  diff: string;
  fileName: string;
  cwd: string;
}

export default function DiffViewer(props: Props) {
  const lines = () => props.diff.split("\n");

  // Parse hunk indices (lines starting with @@)
  const hunkIndices = createMemo(() => {
    const indices: number[] = [];
    const allLines = lines();
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].startsWith("@@")) indices.push(i);
    }
    return indices;
  });

  const [currentHunkIdx, setCurrentHunkIdx] = createSignal(0);

  // Reset hunk index when diff changes
  createEffect(() => {
    props.diff;
    setCurrentHunkIdx(0);
  });

  // Refs for hunk header lines
  const lineRefs = new Map<number, HTMLDivElement>();

  function goToHunk(idx: number) {
    const hunks = hunkIndices();
    if (idx < 0 || idx >= hunks.length) return;
    setCurrentHunkIdx(idx);
    const ref = lineRefs.get(hunks[idx]);
    ref?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function lineClass(line: string): string {
    if (line.startsWith("+") && !line.startsWith("+++")) return "text-[var(--success)] bg-[var(--diff-add-bg)]";
    if (line.startsWith("-") && !line.startsWith("---")) return "text-[var(--danger)] bg-[var(--diff-delete-bg)]";
    if (line.startsWith("@@")) return "text-[var(--accent)] bg-[var(--bg-tertiary)]";
    return "text-[var(--text-secondary)]";
  }

  return (
    <Show when={props.diff}>
      <div class="border border-[var(--border)] rounded overflow-hidden">
        <div class="overflow-y-auto overflow-x-auto max-h-[50vh]">
          {/* Sticky filename bar */}
          <div class="sticky top-0 z-10 px-2 py-1 bg-[var(--bg-tertiary)] border-b border-[var(--border)] flex items-center justify-between group">
            <span class="text-xs font-mono text-[var(--text-primary)]">{props.fileName}</span>
            <OpenFileButton cwd={props.cwd} file={props.fileName} />
          </div>

          {/* Sticky hunk navigation toolbar */}
          <Show when={hunkIndices().length > 0}>
            <div class="sticky top-[28px] z-10 px-2 py-0.5 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between">
              <span class="text-[10px] font-mono text-[var(--text-secondary)]">
                {currentHunkIdx() + 1}/{hunkIndices().length} hunks
              </span>
              <div class="flex items-center gap-0.5">
                <button
                  class="w-5 h-5 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)]"
                  onClick={() => goToHunk(currentHunkIdx() - 1)}
                  disabled={currentHunkIdx() <= 0}
                  title="Previous hunk"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
                    <path fill-rule="evenodd" d="M3.22 9.78a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1-1.06 1.06L8 6.06 4.28 9.78a.75.75 0 0 1-1.06 0z" />
                  </svg>
                </button>
                <button
                  class="w-5 h-5 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)]"
                  onClick={() => goToHunk(currentHunkIdx() + 1)}
                  disabled={currentHunkIdx() >= hunkIndices().length - 1}
                  title="Next hunk"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
                    <path fill-rule="evenodd" d="M12.78 6.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 7.28a.75.75 0 0 1 1.06-1.06L8 9.94l3.72-3.72a.75.75 0 0 1 1.06 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </Show>

          <pre class="text-[11px] font-mono leading-relaxed">
            <For each={lines()}>
              {(line, idx) => (
                <div
                  ref={(el) => {
                    if (hunkIndices().includes(idx())) lineRefs.set(idx(), el);
                  }}
                  class={`px-2 ${lineClass(line)}`}
                >
                  {line || " "}
                </div>
              )}
            </For>
          </pre>
        </div>
      </div>
    </Show>
  );
}
