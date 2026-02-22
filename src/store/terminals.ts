import { state, setState } from "./core";
import { api } from "../lib/api";
import type { TerminalInstance } from "./types";
import { getProviderFromCommand, getResumeSessionId } from "../lib/providers";

export function setTerminalTitle(id: string, title: string) {
  setState("terminals", (t) => t.id === id, "customTitle", title || undefined);
}

export function setTerminalLastOutput(id: string) {
  setState("terminals", (t) => t.id === id, "lastOutputAt", Date.now());
  // Output arrived — terminal is active, clear any attention flag
  setState("terminals", (t) => t.id === id, "needsAttention", false);
}

export function setTerminalNeedsAttention(id: string, value: boolean) {
  setState("terminals", (t) => t.id === id, "needsAttention", value);
}

export function setTerminalMuted(id: string, value: boolean) {
  setState("terminals", (t) => t.id === id, "muted", value);
  if (value) {
    setState("terminals", (t) => t.id === id, "needsAttention", false);
  }
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

export async function addTerminal(cwd?: string, command?: string[], sessionTitle?: string): Promise<string> {
  const activePath = state.workspaces.find((w) => w.id === state.activeWorkspaceId)?.path;
  const activeTerminalCwd = state.terminals.find((t) => t.id === state.activeTerminalId)?.cwd;
  const targetCwd = cwd ?? activePath ?? activeTerminalCwd ?? undefined;

  const result = await api.createPty(targetCwd, command);

  const sessionId = getResumeSessionId(command);
  const provider = getProviderFromCommand(command);

  const terminal: TerminalInstance = {
    id: result.id,
    cwd: result.cwd,
    title: result.cwd.split("/").pop() ?? "terminal",
    wsConnected: false,
    stashed: false,
    panelSize: 1,
    workspaceId: state.activeWorkspaceId ?? undefined,
    sessionId,
    sessionTitle,
    provider,
  };

  setState("terminals", (prev) => [...prev, terminal]);
  setState("activeTerminalId", terminal.id);

  return terminal.id;
}

export async function removeTerminal(id: string) {
  await api.destroyPty(id);
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
  // User is looking at this terminal — clear notification + record view time
  setState("terminals", (t) => t.id === id, "needsAttention", false);
  setState("terminals", (t) => t.id === id, "lastSeenAt", Date.now());
}

export function getTerminalsForWorkspace(wsPath: string): TerminalInstance[] {
  const normalized = wsPath.endsWith("/") ? wsPath : wsPath + "/";
  return state.terminals.filter((t) => t.cwd === wsPath || t.cwd.startsWith(normalized));
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
  setState("terminals", (t) => t.id === id, "needsAttention", false);
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
