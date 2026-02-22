import { setTerminalLastOutput } from "../store/terminals";
import { state } from "../store/core";
import { addNotification } from "./notifications/store";
import { getWsBase } from "./server";
import { createKeyedBatchCoalescer } from "./debounce";

type MessageHandler = (data: ArrayBuffer | string) => void;
type StatusHandler = (connected: boolean) => void;

interface WsConnection {
  ws: WebSocket;
  onData: MessageHandler;
  onStatus: StatusHandler;
}

const connections = new Map<string, WsConnection>();

// Track which terminals are currently known-idle on the client.
// Only create a notification on the idle→ transition, not on repeated idle events.
// Reset when `active` arrives (output resumed).
const knownIdleTerminals = new Set<string>();

// Track bytes received per terminal since last idle→active transition.
// Only notify if a meaningful amount of output was produced (agent turn),
// not just a tiny blip from an IDE click or cursor escape sequence.
// 3000 bytes gives headroom above Claude Code prompt redraws (200-800 bytes ANSI)
// while still catching real agent turns (5KB+).
const OUTPUT_THRESHOLD_BYTES = 3000;
const outputBytesSinceActive = new Map<string, number>();

// Track which terminals have finished replay — only count bytes after replay-done.
// Prevents replay data (up to 128KB) from inflating the output counter.
const replayDoneTerminals = new Set<string>();

// Per-terminal notification cooldown to avoid repeated notifications
// from prompt redraws or rapid idle/active cycling.
const NOTIFICATION_COOLDOWN_MS = 30_000;
const lastNotifiedAt = new Map<string, number>();

const CURSOR_STORAGE_KEY = "bord:terminal-cursors";
const MAX_CURSOR_ENTRIES = 20;

function loadCursors(): Record<string, { cursor: number; scrollY: number }> {
  try {
    return JSON.parse(localStorage.getItem(CURSOR_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveCursor(ptyId: string, cursor: number, scrollY: number = 0) {
  const cursors = loadCursors();
  cursors[ptyId] = { cursor, scrollY };

  // LRU eviction: keep only the most recent entries
  const entries = Object.entries(cursors);
  if (entries.length > MAX_CURSOR_ENTRIES) {
    const sorted = entries.sort(
      ([, a], [, b]) => b.cursor - a.cursor,
    );
    const trimmed = Object.fromEntries(sorted.slice(0, MAX_CURSOR_ENTRIES));
    localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(trimmed));
  } else {
    localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(cursors));
  }
}

export function getStoredCursor(ptyId: string): { cursor: number; scrollY: number } | null {
  const cursors = loadCursors();
  return cursors[ptyId] ?? null;
}

// Batch output timestamp updates at ~30fps to avoid setState churn
const outputCoalescer = createKeyedBatchCoalescer<string, number>(
  33,
  (batch) => {
    for (const [ptyId] of batch) {
      setTerminalLastOutput(ptyId);
    }
  },
);

export function connectTerminal(
  ptyId: string,
  onData: MessageHandler,
  onStatus: StatusHandler,
): () => void {
  // Reset replay/output state for this connection
  replayDoneTerminals.delete(ptyId);
  outputBytesSinceActive.set(ptyId, 0);

  // Use stored cursor for replay
  const stored = getStoredCursor(ptyId);
  const cursorParam = stored?.cursor ? `?cursor=${stored.cursor}` : "";
  const url = `${getWsBase()}/ws/pty/${ptyId}${cursorParam}`;
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => onStatus(true);
  ws.onclose = () => onStatus(false);
  ws.onerror = () => onStatus(false);
  ws.onmessage = (event) => {
    // Check for control frames (text JSON with type field)
    if (typeof event.data === "string") {
      try {
        const ctrl = JSON.parse(event.data);
        if (ctrl.type === "cursor" && typeof ctrl.cursor === "number") {
          saveCursor(ptyId, ctrl.cursor);
          return; // Don't forward control frames to terminal
        }
        if (ctrl.type === "replay-done") {
          replayDoneTerminals.add(ptyId);
          outputBytesSinceActive.set(ptyId, 0);
          return;
        }
        if (ctrl.type === "idle") {
          const alreadyKnown = knownIdleTerminals.has(ptyId);
          if (!alreadyKnown) {
            knownIdleTerminals.add(ptyId);
            const bytes = outputBytesSinceActive.get(ptyId) ?? 0;
            if (bytes >= OUTPUT_THRESHOLD_BYTES) {
              handleIdleEvent(ptyId);
            }
            outputBytesSinceActive.set(ptyId, 0);
          }
          return;
        }
        if (ctrl.type === "active") {
          knownIdleTerminals.delete(ptyId);
          outputBytesSinceActive.set(ptyId, 0);
          return;
        }
      } catch {
        // Not JSON control frame, forward as terminal data
      }
    }
    onData(event.data);
    // Track output volume for idle notification threshold — only after replay is done
    if (replayDoneTerminals.has(ptyId)) {
      const dataLen = event.data instanceof ArrayBuffer ? event.data.byteLength
        : typeof event.data === "string" ? event.data.length : 0;
      outputBytesSinceActive.set(ptyId, (outputBytesSinceActive.get(ptyId) ?? 0) + dataLen);
    }
    outputCoalescer.enqueue(ptyId, Date.now());
  };

  connections.set(ptyId, { ws, onData, onStatus });

  // Return cleanup function
  return () => {
    ws.close();
    connections.delete(ptyId);
    knownIdleTerminals.delete(ptyId);
    outputBytesSinceActive.delete(ptyId);
    replayDoneTerminals.delete(ptyId);
    lastNotifiedAt.delete(ptyId);
  };
}

function handleIdleEvent(ptyId: string) {
  const terminal = state.terminals.find((t) => t.id === ptyId);
  if (!terminal) return;

  // Only notify for provider terminals (AI agents), not plain shells
  if (!terminal.provider) return;

  // Respect mute flags
  if (terminal.muted || state.bellMuted) return;

  // Suppress if user was viewing this terminal recently (fixes workspace-switch race)
  if (terminal.lastSeenAt && Date.now() - terminal.lastSeenAt < 10_000) return;

  // Per-terminal cooldown to avoid repeated notifications from prompt redraws
  const lastNotified = lastNotifiedAt.get(ptyId) ?? 0;
  if (Date.now() - lastNotified < NOTIFICATION_COOLDOWN_MS) return;

  lastNotifiedAt.set(ptyId, Date.now());

  addNotification({
    type: "turn-complete",
    terminalId: ptyId,
    workspaceId: terminal.workspaceId,
    provider: terminal.provider,
    title: terminal.customTitle || terminal.sessionTitle || terminal.title || "Terminal",
    body: `${terminal.provider} session is idle`,
    isActiveTerminal: state.activeTerminalId === ptyId,
    isAppFocused: document.hasFocus(),
  });
}

export function sendToTerminal(ptyId: string, data: string | Uint8Array) {
  const conn = connections.get(ptyId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;
  conn.ws.send(data);
}

export function sendResize(ptyId: string, cols: number, rows: number) {
  const conn = connections.get(ptyId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;
  conn.ws.send(JSON.stringify({ type: "resize", cols, rows }));
}

export function sendConfigureToAll(idleThresholdMs: number) {
  const msg = JSON.stringify({ type: "configure", idleThresholdMs });
  for (const [, conn] of connections) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(msg);
    }
  }
}
