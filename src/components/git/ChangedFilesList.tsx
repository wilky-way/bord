import { For, Show } from "solid-js";
import type { GitStatus } from "../../store/types";
import OpenFileButton from "../shared/OpenFileButton";

interface Props {
  status: GitStatus;
  cwd: string;
  fileStats?: {
    staged: Record<string, { insertions: number; deletions: number }>;
    unstaged: Record<string, { insertions: number; deletions: number }>;
  } | null;
  onViewDiff: (file: string, staged: boolean) => void;
  onStage: (file: string) => void;
  onUnstage: (file: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onOpenFile: (file: string) => void;
}

function DiffCounts(props: { insertions: number; deletions: number }) {
  return (
    <span class="font-mono text-[10px] whitespace-nowrap flex-shrink-0">
      <Show when={props.insertions > 0}>
        <span class="text-[var(--success)]">+{props.insertions}</span>
      </Show>
      <Show when={props.insertions > 0 && props.deletions > 0}>
        <span class="text-[var(--text-secondary)]"> </span>
      </Show>
      <Show when={props.deletions > 0}>
        <span class="text-[var(--danger)]">-{props.deletions}</span>
      </Show>
    </span>
  );
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
            {(file) => {
              const stats = () => props.fileStats?.staged[file.path];
              return (
                <div class="flex items-center gap-2 py-0.5 group">
                  <StatusBadge status={file.status} />
                  <button
                    class="flex-1 text-left text-xs text-[var(--text-primary)] truncate hover:text-[var(--accent)]"
                    onClick={() => props.onViewDiff(file.path, true)}
                    onDblClick={() => props.onOpenFile(file.path)}
                  >
                    {file.path}
                  </button>
                  <Show when={stats()}>
                    {(s) => <DiffCounts insertions={s().insertions} deletions={s().deletions} />}
                  </Show>
                  <OpenFileButton cwd={props.cwd} file={file.path} />
                  <button
                    class="text-xs text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 hover:text-[var(--danger)] w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)]"
                    onClick={() => props.onUnstage(file.path)}
                  >
                    −
                  </button>
                </div>
              );
            }}
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
            {(file) => {
              const stats = () => props.fileStats?.unstaged[file.path];
              return (
                <div class="flex items-center gap-2 py-0.5 group">
                  <StatusBadge status={file.status} />
                  <button
                    class="flex-1 text-left text-xs text-[var(--text-primary)] truncate hover:text-[var(--accent)]"
                    onClick={() => props.onViewDiff(file.path, false)}
                    onDblClick={() => props.onOpenFile(file.path)}
                  >
                    {file.path}
                  </button>
                  <Show when={stats()}>
                    {(s) => <DiffCounts insertions={s().insertions} deletions={s().deletions} />}
                  </Show>
                  <OpenFileButton cwd={props.cwd} file={file.path} />
                  <button
                    class="text-xs text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 hover:text-[var(--success)] w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)]"
                    onClick={() => props.onStage(file.path)}
                  >
                    +
                  </button>
                </div>
              );
            }}
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
              <div class="flex items-center gap-2 py-0.5 group">
                <span class="font-mono text-[10px] w-3 text-[var(--text-secondary)]">?</span>
                <button
                  class="flex-1 text-left text-xs text-[var(--text-secondary)] truncate hover:text-[var(--accent)]"
                  onDblClick={() => props.onOpenFile(file)}
                >
                  {file}
                </button>
                <OpenFileButton cwd={props.cwd} file={file} />
                <button
                  class="text-xs text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 hover:text-[var(--success)] w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)]"
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
