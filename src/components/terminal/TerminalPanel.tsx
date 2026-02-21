import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import TerminalView from "./TerminalView";
import { removeTerminal, setActiveTerminal, stashTerminal, setTerminalTitle } from "../../store/terminals";
import { state } from "../../store/core";
import { ClaudeIcon } from "../icons/ProviderIcons";
import EditorButton from "../shared/EditorButton";
import { api } from "../../lib/api";

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
  const displayTitle = () => terminal()?.customTitle || terminal()?.sessionTitle || title();
  const [branch, setBranch] = createSignal<string | null>(null);
  const [dirty, setDirty] = createSignal(false);
  const [ahead, setAhead] = createSignal(0);
  const [pushing, setPushing] = createSignal(false);
  const [pushDone, setPushDone] = createSignal(false);

  async function fetchGitInfo() {
    try {
      const [status, ab] = await Promise.all([
        api.gitStatus(props.cwd),
        api.gitAheadBehind(props.cwd),
      ]);
      setBranch(status.branch || null);
      setDirty(status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0);
      setAhead(ab.ahead);
    } catch {
      setBranch(null);
      setDirty(false);
      setAhead(0);
    }
  }

  let interval: ReturnType<typeof setInterval>;
  onMount(() => {
    fetchGitInfo();
    interval = setInterval(fetchGitInfo, 10_000);
    if (props.isActive && panelRef) {
      panelRef.scrollIntoView({ inline: "nearest", behavior: "instant" });
    }
  });
  onCleanup(() => clearInterval(interval));

  createEffect(() => {
    if (props.isActive && panelRef) {
      panelRef.scrollIntoView({ inline: "nearest", behavior: "instant" });
    }
  });

  async function handlePush() {
    setPushing(true);
    try {
      const result = await api.gitPush(props.cwd);
      if (result.ok) {
        setPushDone(true);
        setAhead(0);
        setTimeout(() => setPushDone(false), 3000);
      }
    } finally {
      setPushing(false);
    }
  }

  return (
    <div
      ref={panelRef}
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
          {/* Branch badge + dirty indicator */}
          <Show when={branch()}>
            <div class="flex items-center gap-1 shrink-0">
              <span
                class="w-1.5 h-1.5 rounded-full"
                classList={{
                  "bg-[var(--success)]": !dirty(),
                  "bg-[var(--warning)]": dirty(),
                }}
              />
              <span class="text-[10px] font-mono text-[var(--accent)]">{branch()}</span>
            </div>
          </Show>
          <Show when={!editing()} fallback={
            <input
              class="bg-transparent text-[var(--text-primary)] text-xs outline-none border-b border-[var(--accent)] w-24"
              value={editValue()}
              onInput={(e) => setEditValue(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setTerminalTitle(props.id, editValue()); setEditing(false); }
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={() => { setTerminalTitle(props.id, editValue()); setEditing(false); }}
              autofocus
            />
          }>
            <Show when={terminal()?.sessionId}>
              <span class="shrink-0 mr-0.5 flex items-center"><ClaudeIcon size={11} /></span>
            </Show>
            <span
              class="text-xs text-[var(--text-secondary)] truncate cursor-text"
              onDblClick={() => { setEditValue(displayTitle()); setEditing(true); }}
            >
              {displayTitle()}
            </span>
          </Show>
          <span class="text-[10px] text-[var(--text-secondary)] opacity-50 truncate">
            {props.cwd}
          </span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
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
          <EditorButton cwd={props.cwd} size="md" />
          <button
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

      {/* Terminal */}
      <div class="flex-1 min-h-0 overflow-hidden">
        <TerminalView
          ptyId={props.id}
          onTitleChange={setTitle}
        />
      </div>
    </div>
  );
}
