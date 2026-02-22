import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { api } from "../../lib/api";
import { getPreferredEditor, setPreferredEditor, type Editor } from "../../lib/editor-preference";
import { VSCodeIcon, CursorIcon } from "../icons/ProviderIcons";

const EDITORS: Record<Editor, { label: string; Icon: typeof VSCodeIcon }> = {
  vscode: { label: "VS Code", Icon: VSCodeIcon },
  cursor: { label: "Cursor", Icon: CursorIcon },
};

interface Props {
  cwd: string;
  size?: "sm" | "md";
}

export default function EditorButton(props: Props) {
  const [open, setOpen] = createSignal(false);

  const sm = () => props.size === "sm";
  const iconSize = () => sm() ? 11 : 12;

  const handleOpen = (e: MouseEvent) => {
    e.stopPropagation();
    api.openInEditor(props.cwd, getPreferredEditor());
  };

  const handleDropdown = (e: MouseEvent) => {
    e.stopPropagation();
    setOpen(!open());
  };

  const handleSelect = (editor: Editor, e: MouseEvent) => {
    e.stopPropagation();
    setPreferredEditor(editor);
    setOpen(false);
    api.openInEditor(props.cwd, editor);
  };

  // Close dropdown on outside click
  let containerRef: HTMLDivElement | undefined;
  const handleClickOutside = (e: MouseEvent) => {
    if (open() && containerRef && !containerRef.contains(e.target as Node)) {
      setOpen(false);
    }
  };

  onMount(() => {
    if (typeof document === "undefined") return;
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  return (
    <div ref={containerRef} class="relative flex items-center shrink-0">
      <button
        class="flex items-center justify-center rounded-l-[var(--btn-radius)] transition-colors"
        classList={{
          "text-[10px] px-1 py-0.5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)]": sm(),
          "text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs w-6 h-6 hover:bg-[var(--bg-tertiary)]": !sm(),
        }}
        onClick={handleOpen}
        title={`Open in ${EDITORS[getPreferredEditor()].label}`}
      >
        <Dynamic component={EDITORS[getPreferredEditor()].Icon} size={iconSize()} />
      </button>
      <button
        class="flex items-center justify-center rounded-r-[var(--btn-radius)] transition-colors border-l border-[var(--border)]"
        classList={{
          "text-[10px] px-0.5 py-0.5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)]": sm(),
          "text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs w-3 h-6 hover:bg-[var(--bg-tertiary)]": !sm(),
        }}
        onClick={handleDropdown}
        title="Choose editor"
      >
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <Show when={open()}>
        <div class="absolute top-full right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--btn-radius)] shadow-lg z-50 min-w-[120px] py-0.5">
          {(Object.entries(EDITORS) as [Editor, typeof EDITORS["vscode"]][]).map(
            ([key, { label, Icon }]) => (
              <button
                class="flex items-center gap-2 w-full px-2 py-1 text-[10px] transition-colors"
                classList={{
                  "text-[var(--accent)] bg-[var(--bg-tertiary)]": getPreferredEditor() === key,
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": getPreferredEditor() !== key,
                }}
                onClick={(e) => handleSelect(key, e)}
              >
                <Icon size={12} />
                <span>{label}</span>
              </button>
            )
          )}
        </div>
      </Show>
    </div>
  );
}
