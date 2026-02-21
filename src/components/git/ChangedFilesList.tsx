import { For, Show } from "solid-js";
import type { GitStatus } from "../../store/types";

interface Props {
  status: GitStatus;
  onViewDiff: (file: string, staged: boolean) => void;
  onStage: (file: string) => void;
  onUnstage: (file: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
}

function StatusBadge(props: { status: string }) {
  const color = () => {
    switch (props.status) {
      case "M": return "text-[var(--warning)]";
      case "A": return "text-[var(--success)]";
      case "D": return "text-[var(--danger)]";
      default: return "text-[var(--text-secondary)]";
    }
  };

  return <span class={`font-mono text-[10px] w-3 ${color()}`}>{props.status}</span>;
}

export default function ChangedFilesList(props: Props) {
  return (
    <div class="space-y-2">
      {/* Staged */}
      <Show when={props.status.staged.length > 0}>
        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="text-[10px] text-[var(--success)] uppercase tracking-wider font-medium">Staged</div>
            <button
              class="text-[10px] text-[var(--text-secondary)] hover:text-[var(--danger)]"
              onClick={() => props.onUnstageAll()}
            >
              Unstage All
            </button>
          </div>
          <For each={props.status.staged}>
            {(file) => (
              <div class="flex items-center gap-1 py-0.5 group">
                <StatusBadge status={file.status} />
                <button
                  class="flex-1 text-left text-xs text-[var(--text-primary)] truncate hover:text-[var(--accent)]"
                  onClick={() => props.onViewDiff(file.path, true)}
                >
                  {file.path}
                </button>
                <button
                  class="text-[10px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 hover:text-[var(--danger)]"
                  onClick={() => props.onUnstage(file.path)}
                >
                  −
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Unstaged */}
      <Show when={props.status.unstaged.length > 0}>
        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="text-[10px] text-[var(--warning)] uppercase tracking-wider font-medium">Changed</div>
            <button
              class="text-[10px] text-[var(--text-secondary)] hover:text-[var(--success)]"
              onClick={() => props.onStageAll()}
            >
              Stage All
            </button>
          </div>
          <For each={props.status.unstaged}>
            {(file) => (
              <div class="flex items-center gap-1 py-0.5 group">
                <StatusBadge status={file.status} />
                <button
                  class="flex-1 text-left text-xs text-[var(--text-primary)] truncate hover:text-[var(--accent)]"
                  onClick={() => props.onViewDiff(file.path, false)}
                >
                  {file.path}
                </button>
                <button
                  class="text-[10px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 hover:text-[var(--success)]"
                  onClick={() => props.onStage(file.path)}
                >
                  +
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Untracked */}
      <Show when={props.status.untracked.length > 0}>
        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-medium">Untracked</div>
            <button
              class="text-[10px] text-[var(--text-secondary)] hover:text-[var(--success)]"
              onClick={() => props.onStageAll()}
            >
              Stage All
            </button>
          </div>
          <For each={props.status.untracked}>
            {(file) => (
              <div class="flex items-center gap-1 py-0.5 group">
                <span class="font-mono text-[10px] w-3 text-[var(--text-secondary)]">?</span>
                <span class="flex-1 text-xs text-[var(--text-secondary)] truncate">{file}</span>
                <button
                  class="text-[10px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 hover:text-[var(--success)]"
                  onClick={() => props.onStage(file)}
                >
                  +
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.status.staged.length === 0 && props.status.unstaged.length === 0 && props.status.untracked.length === 0}>
        <div class="text-xs text-[var(--text-secondary)] py-2 text-center">Working tree clean</div>
      </Show>
    </div>
  );
}
