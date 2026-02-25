import { setTerminalLastOutput, setTerminalArmed, setTerminalDynamicCwd } from "../store/terminals";
import { state } from "../store/core";
import { addNotification, getSettings } from "./notifications/store";
import { getWsBase } from "./server";
import { createKeyedBatchCoalescer } from "./debounce";

type MessageHandler = (data: ArrayBuffer | string) => void;
type StatusHandler = (connected: boolean) => void;

interface ConnectOptions {
  onReplayStart?: (meta: { from: number; to: number; truncated: boolean }) => void;
  onReplayDone?: () => void;
}

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

// Per-terminal arming timers — agent must work this long before notifications arm.
const armingTimers = new Map<string, Timer>();

// Track when the user last sent input (keystroke, paste, Ctrl-C, etc.) to each
// terminal.  When the arming timer fires we check recency — if the user was
// typing recently the output is TUI redraws, not real agent work.
const lastUserInputAt = new Map<string, number>();
const USER_INPUT_RECENCY_MS = 3_000;
const ARMING_RETRY_MS = 2_000;

// Per-terminal notification cooldown to avoid repeated notifications
// from prompt redraws or rapid idle/active cycling.
const NOTIFICATION_COOLDOWN_MS = 30_000;
const lastNotifiedAt = new Map<string, number>();


const CURSOR_STORAGE_KEY = "bord:terminal-cursors";
const MAX_CURSOR_ENTRIES = 20;
const liveCursorByTerminal = new Map<string, number>();
const textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

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

const cursorPersistCoalescer = createKeyedBatchCoalescer<string, number>(
  250,
  (batch) => {
    for (const [ptyId, cursor] of batch) {
      saveCursor(ptyId, cursor);
    }
  },
);

function setLiveCursor(ptyId: string, cursor: number) {
  const safeCursor = Math.max(0, Math.floor(cursor));
  liveCursorByTerminal.set(ptyId, safeCursor);
  cursorPersistCoalescer.enqueue(ptyId, safeCursor);
}

function payloadByteLength(data: ArrayBuffer | string): number {
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (!data) return 0;
  return textEncoder ? textEncoder.encode(data).byteLength : data.length;
}

function advanceLiveCursor(ptyId: string, data: ArrayBuffer | string) {
  const bytes = payloadByteLength(data);
  if (bytes <= 0) return;
  const current = liveCursorByTerminal.get(ptyId) ?? getStoredCursor(ptyId)?.cursor ?? 0;
  setLiveCursor(ptyId, current + bytes);
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

/** Try to arm a provider terminal.  If the user was typing recently the check
 *  is retried on a short interval until either the user stops typing (→ arm)
 *  or the terminal goes idle (→ timer cleared, no arm). */
function tryArm(ptyId: string) {
  const lastInput = lastUserInputAt.get(ptyId) ?? 0;
  if (Date.now() - lastInput < USER_INPUT_RECENCY_MS) {
    // User was typing — retry shortly
    armingTimers.set(ptyId, setTimeout(() => tryArm(ptyId), ARMING_RETRY_MS));
    return;
  }
  armingTimers.delete(ptyId);
  setTerminalArmed(ptyId, true);
}

export function connectTerminal(
  ptyId: string,
  onData: MessageHandler,
  onStatus: StatusHandler,
  options?: ConnectOptions,
): () => void {
  const existing = connections.get(ptyId);
  if (existing) {
    const existingCursor = liveCursorByTerminal.get(ptyId);
    if (typeof existingCursor === "number") {
      saveCursor(ptyId, existingCursor);
    }

    existing.ws.onopen = null;
    existing.ws.onclose = null;
    existing.ws.onerror = null;
    existing.ws.onmessage = null;
    existing.ws.close();
    connections.delete(ptyId);
    knownIdleTerminals.delete(ptyId);
    lastUserInputAt.delete(ptyId);
    lastNotifiedAt.delete(ptyId);

    const pending = armingTimers.get(ptyId);
    if (pending) {
      clearTimeout(pending);
      armingTimers.delete(ptyId);
    }
  }

  // Use stored cursor for replay
  const stored = getStoredCursor(ptyId);
  const initialCursor = Math.max(0, stored?.cursor ?? 0);
  const cursorParam = initialCursor > 0 ? `?cursor=${initialCursor}` : "";
  const url = `${getWsBase()}/ws/pty/${ptyId}${cursorParam}`;
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";
  liveCursorByTerminal.set(ptyId, initialCursor);

  ws.onopen = () => onStatus(true);
  ws.onclose = () => onStatus(false);
  ws.onerror = () => onStatus(false);
  ws.onmessage = (event) => {
    // Check for control frames (text JSON with type field)
    if (typeof event.data === "string") {
      try {
        const ctrl = JSON.parse(event.data);
        if (
          ctrl.type === "replay-start" &&
          typeof ctrl.from === "number" &&
          typeof ctrl.to === "number" &&
          typeof ctrl.truncated === "boolean"
        ) {
          options?.onReplayStart?.({
            from: ctrl.from,
            to: ctrl.to,
            truncated: ctrl.truncated,
          });
          return;
        }
        if (ctrl.type === "cursor" && typeof ctrl.cursor === "number") {
          setLiveCursor(ptyId, ctrl.cursor);
          return; // Don't forward control frames to terminal
        }
        if (ctrl.type === "replay-done") {
          options?.onReplayDone?.();
          return;
        }
        if (ctrl.type === "idle") {
          const alreadyKnown = knownIdleTerminals.has(ptyId);
          if (!alreadyKnown) {
            knownIdleTerminals.add(ptyId);

            // Clear pending arming timer — agent didn't work long enough
            const pending = armingTimers.get(ptyId);
            if (pending) {
              clearTimeout(pending);
              armingTimers.delete(ptyId);
            }

            // If armed → fire notification + disarm
            const terminal = state.terminals.find((t) => t.id === ptyId);
            if (terminal?.notificationsArmed) {
              handleIdleEvent(ptyId);
              setTerminalArmed(ptyId, false);
            }
          }
          return;
        }
        if (ctrl.type === "active") {
          knownIdleTerminals.delete(ptyId);

          // Start arming timer if this is a provider terminal, not already armed, and no timer pending
          const terminal = state.terminals.find((t) => t.id === ptyId);
          if (terminal?.provider && !terminal.notificationsArmed && !armingTimers.has(ptyId)) {
            const delay = getSettings().warmupDurationMs;
            armingTimers.set(ptyId, setTimeout(() => tryArm(ptyId), delay));
          }
          return;
        }
        if (ctrl.type === "cwd" && typeof ctrl.path === "string") {
          setTerminalDynamicCwd(ptyId, ctrl.path);
          return;
        }

        if (typeof ctrl.type === "string") {
          return;
        }
      } catch {
        // Not JSON control frame, forward as terminal data
      }
    }

    if (!(event.data instanceof ArrayBuffer) && typeof event.data !== "string") {
      return;
    }

    onData(event.data);
    advanceLiveCursor(ptyId, event.data);
    outputCoalescer.enqueue(ptyId, Date.now());
  };

  connections.set(ptyId, { ws, onData, onStatus });

  // Return cleanup function
  return () => {
    const cursor = liveCursorByTerminal.get(ptyId);
    if (typeof cursor === "number") {
      saveCursor(ptyId, cursor);
    }

    ws.close();
    connections.delete(ptyId);
    liveCursorByTerminal.delete(ptyId);
    knownIdleTerminals.delete(ptyId);
    lastUserInputAt.delete(ptyId);
    lastNotifiedAt.delete(ptyId);
    // Clear arming timer on disconnect, but do NOT disarm — armed state
    // persists in store across tab switches.
    const pending = armingTimers.get(ptyId);
    if (pending) {
      clearTimeout(pending);
      armingTimers.delete(ptyId);
    }
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
  lastUserInputAt.set(ptyId, Date.now());
  const conn = connections.get(ptyId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;
  conn.ws.send(data);
}

export function sendResize(ptyId: string, cols: number, rows: number) {
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return;

  const conn = connections.get(ptyId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

  const safeCols = Math.max(2, Math.min(1000, Math.floor(cols)));
  const safeRows = Math.max(1, Math.min(500, Math.floor(rows)));
  conn.ws.send(JSON.stringify({ type: "resize", cols: safeCols, rows: safeRows }));
}

export function sendConfigureToAll(idleThresholdMs: number) {
  const msg = JSON.stringify({ type: "configure", idleThresholdMs });
  for (const [, conn] of connections) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(msg);
    }
  }
}
