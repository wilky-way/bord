import { For, Show } from "solid-js";

interface Props {
  diff: string;
  fileName: string;
}

export default function DiffViewer(props: Props) {
  const lines = () => props.diff.split("\n");

  function lineClass(line: string): string {
    if (line.startsWith("+") && !line.startsWith("+++")) return "text-[var(--success)] bg-[#12261e]";
    if (line.startsWith("-") && !line.startsWith("---")) return "text-[var(--danger)] bg-[#2d1215]";
    if (line.startsWith("@@")) return "text-[var(--accent)] bg-[var(--bg-tertiary)]";
    return "text-[var(--text-secondary)]";
  }

  return (
    <Show when={props.diff}>
      <div class="border border-[var(--border)] rounded overflow-hidden">
        <div class="px-2 py-1 bg-[var(--bg-tertiary)] border-b border-[var(--border)]">
          <span class="text-xs font-mono text-[var(--text-primary)]">{props.fileName}</span>
        </div>
        <div class="overflow-x-auto max-h-48 overflow-y-auto">
          <pre class="text-[11px] font-mono leading-relaxed">
            <For each={lines()}>
              {(line) => (
                <div class={`px-2 ${lineClass(line)}`}>{line || " "}</div>
              )}
            </For>
          </pre>
        </div>
      </div>
    </Show>
  );
}
