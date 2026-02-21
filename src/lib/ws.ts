import { setTerminalLastOutput } from "../store/terminals";

type MessageHandler = (data: ArrayBuffer | string) => void;
type StatusHandler = (connected: boolean) => void;

interface WsConnection {
  ws: WebSocket;
  onData: MessageHandler;
  onStatus: StatusHandler;
}

const connections = new Map<string, WsConnection>();

const CURSOR_STORAGE_KEY = "bord:terminal-cursors";
const MAX_CURSOR_ENTRIES = 20;

function getWsBase(): string {
  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}`;
}

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

export function connectTerminal(
  ptyId: string,
  onData: MessageHandler,
  onStatus: StatusHandler,
): () => void {
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
      } catch {
        // Not JSON control frame, forward as terminal data
      }
    }
    onData(event.data);
    setTerminalLastOutput(ptyId);
  };

  connections.set(ptyId, { ws, onData, onStatus });

  // Return cleanup function
  return () => {
    ws.close();
    connections.delete(ptyId);
  };
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
