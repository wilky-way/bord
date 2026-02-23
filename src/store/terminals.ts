import { state, setState } from "./core";
import { api } from "../lib/api";
import type { TerminalInstance } from "./types";
import { getProviderFromCommand, getResumeSessionId } from "../lib/providers";
import { markViewed, clearForTerminal } from "../lib/notifications/store";

export function setTerminalTitle(id: string, title: string) {
  setState("terminals", (t) => t.id === id, "customTitle", title || undefined);
}

/** Strip leading emoji/symbol clusters that CLI tools prepend to terminal titles
 *  (e.g. "✳️ Claude Code" → "Claude Code"). Bord already renders SVG provider icons,
 *  so the emoji prefix is redundant visual noise. */
function stripLeadingEmoji(title: string): string {
  // Match one or more leading emoji (with optional variation selectors / ZWJ sequences) + trailing space
  return title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0e\ufe0f]+\s*/u, "").trim() || title;
}

export function setTerminalOscTitle(id: string, title: string) {
  const cleaned = stripLeadingEmoji(title);
  setState("terminals", (t) => t.id === id, "title", cleaned);
  // OSC title from the running program supersedes the initial session label
  setState("terminals", (t) => t.id === id, "sessionTitle", undefined);
}

export function setTerminalLastOutput(id: string) {
  setState("terminals", (t) => t.id === id, "lastOutputAt", Date.now());
}

export function setTerminalFirstOutput(id: string) {
  const terminal = state.terminals.find((t) => t.id === id);
  if (terminal && !terminal.firstOutputAt) {
    setState("terminals", (t) => t.id === id, "firstOutputAt", Date.now());
  }
}

export function setTerminalMuted(id: string, value: boolean) {
  setState("terminals", (t) => t.id === id, "muted", value);
}

export function setTerminalLastSeen(id: string) {
  setState("terminals", (t) => t.id === id, "lastSeenAt", Date.now());
}

/** Returns terminals filtered by workspace scope: non-stashed AND matching active workspace (or all if no workspace selected). */
export function getVisibleTerminals(): TerminalInstance[] {
  const wsId = state.activeWorkspaceId;
  return state.terminals.filter(
    (t) => !t.stashed && (!wsId || t.workspaceId === wsId),
  );
}

export async function addTerminal(cwd?: string, command?: string[], sessionTitle?: string): Promise<string | null> {
  const activeWorkspaceId = state.activeWorkspaceId;
  if (!activeWorkspaceId) return null;

  const activePath = state.workspaces.find((w) => w.id === activeWorkspaceId)?.path;
  const activeTerminalCwd = state.terminals.find((t) => t.id === state.activeTerminalId)?.cwd;
  const targetCwd = cwd ?? activePath ?? activeTerminalCwd ?? undefined;

  const result = await api.createPty(targetCwd, command, activeWorkspaceId);

  const sessionId = getResumeSessionId(command);
  const provider = getProviderFromCommand(command);

  const terminal: TerminalInstance = {
    id: result.id,
    cwd: result.cwd,
    title: result.cwd.split("/").pop() ?? "terminal",
    wsConnected: false,
    stashed: false,
    panelSize: 1,
    workspaceId: activeWorkspaceId,
    sessionId,
    sessionTitle,
    provider,
    createdAt: Date.now(),
  };

  setState("terminals", (prev) => [...prev, terminal]);
  setState("activeTerminalId", terminal.id);

  return terminal.id;
}

export async function removeTerminal(id: string) {
  await api.destroyPty(id);
  clearForTerminal(id);
  const removedTerminal = state.terminals.find((t) => t.id === id);
  setState("terminals", (prev) => prev.filter((t) => t.id !== id));

  if (state.activeTerminalId === id) {
    // Prefer a visible terminal in the same workspace scope
    const visible = getVisibleTerminals().filter((t) => t.id !== id);
    // If the removed terminal had a workspace, try same-workspace first
    const sameWs = removedTerminal?.workspaceId
      ? visible.find((t) => t.workspaceId === removedTerminal.workspaceId)
      : undefined;
    setState("activeTerminalId", sameWs?.id ?? visible[0]?.id ?? null);
  }
}

export function setActiveTerminal(id: string) {
  setState("activeTerminalId", id);
  // User is looking at this terminal — mark notifications viewed + record view time
  markViewed(id);
  setState("terminals", (t) => t.id === id, "lastSeenAt", Date.now());
}

export function getTerminalsForWorkspace(workspaceId: string): TerminalInstance[] {
  return state.terminals.filter((t) => t.workspaceId === workspaceId);
}

export function stashTerminal(id: string) {
  setState("terminals", (t) => t.id === id, "stashed", true);
  // If stashing the active terminal, switch to next visible in workspace scope
  if (state.activeTerminalId === id) {
    const next = getVisibleTerminals().find((t) => t.id !== id);
    setState("activeTerminalId", next?.id ?? null);
  }
}

export function unstashTerminal(id: string) {
  setState("terminals", (t) => t.id === id, "stashed", false);
  markViewed(id);
  setState("terminals", (t) => t.id === id, "lastSeenAt", Date.now());
  setState("activeTerminalId", id);
}

export function setTerminalConnected(id: string, connected: boolean) {
  setState(
    "terminals",
    (t) => t.id === id,
    "wsConnected",
    connected
  );
}

export function activateAdjacentTerminal(direction: "prev" | "next") {
  const visible = getVisibleTerminals();
  if (visible.length <= 1) return;
  const idx = visible.findIndex((t) => t.id === state.activeTerminalId);
  if (idx === -1) return;
  const next =
    direction === "next"
      ? (idx + 1) % visible.length
      : (idx - 1 + visible.length) % visible.length;
  setActiveTerminal(visible[next].id);
}

export function moveTerminal(fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return;
  setState("terminals", (prev) => {
    const next = [...prev];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  });
}
