import { createMemo } from "solid-js";
import { state, setState } from "../../store/core";
import { addTerminal, unstashTerminal } from "../../store/terminals";
import type { SessionInfo } from "../../store/types";
import { buildResumeCommand } from "../../lib/providers";

interface Props {
  session: SessionInfo;
}

export default function SessionCard(props: Props) {
  const linkedTerminal = createMemo(() =>
    state.terminals.find((t) => t.sessionId === props.session.id)
  );

  function selectMatchingWorkspace(path: string) {
    const ws = state.workspaces.find(
      (w) => path === w.path || path.startsWith(w.path.endsWith("/") ? w.path : w.path + "/")
    );
    if (ws && ws.id !== state.activeWorkspaceId) {
      setState("activeWorkspaceId", ws.id);
    }
  }

  function handleClick() {
    const terminal = linkedTerminal();
    if (terminal) {
      selectMatchingWorkspace(terminal.cwd);
      if (terminal.stashed) {
        unstashTerminal(terminal.id);
      } else {
        setState("activeTerminalId", terminal.id);
      }
    } else {
      const projectPath = props.session.projectPath;
      const sessionId = props.session.id;
      selectMatchingWorkspace(projectPath);
      const resumeCommand = buildResumeCommand(props.session.provider, sessionId);
      addTerminal(projectPath, resumeCommand, props.session.title);
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <button
      class="w-full text-left px-2 py-1.5 rounded-[var(--btn-radius)] text-xs mb-0.5 transition-colors cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-tertiary))]"
      classList={{
        "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] animate-pulse": !!linkedTerminal()?.needsAttention,
      }}
      onClick={handleClick}
    >
      <div class="flex items-center gap-1.5 min-w-0">
        {linkedTerminal() && (
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0"
            classList={{
              "bg-[var(--warning)] animate-pulse": !!linkedTerminal()!.needsAttention,
              "bg-[var(--warning)]": !linkedTerminal()!.needsAttention && linkedTerminal()!.stashed,
              "bg-[var(--success)]": !linkedTerminal()!.needsAttention && !linkedTerminal()!.stashed,
            }}
          />
        )}
        <span classList={{
          "text-[var(--warning)]": !!linkedTerminal()?.needsAttention,
          "text-[var(--text-primary)]": !linkedTerminal()?.needsAttention,
        }} class="truncate flex-1">
          –&nbsp;&nbsp;{props.session.title}
        </span>
        <span class="text-[10px] text-[var(--text-secondary)] shrink-0">
          {props.session.messageCount} msgs
        </span>
        <span class="text-[10px] text-[var(--text-secondary)] shrink-0">
          {timeAgo(props.session.updatedAt)}
        </span>
      </div>
    </button>
  );
}
