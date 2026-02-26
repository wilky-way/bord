import {
  setTerminalLastOutput,
  setTerminalArmed,
  setTerminalDynamicCwd,
  setTerminalWarmupStartedAt,
} from "../store/terminals";
import { state } from "../store/core";
import { addNotification, getSettings } from "./notifications/store";
import { getWsBase } from "./server";
import { createKeyedBatchCoalescer } from "./debounce";
import type { Provider } from "../store/types";

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
  bufferingOutput: boolean;
  bufferedOutput: Array<ArrayBuffer | string>;
  bufferedBytes: number;
}

const noopData: MessageHandler = () => {};
const noopStatus: StatusHandler = () => {};

const connections = new Map<string, WsConnection>();

type OscTurnState = "working" | "done" | "unknown";

// Per-terminal state derived from OSC title updates.
const oscTurnStateByTerminal = new Map<string, OscTurnState>();
const lastOscTitleByTerminal = new Map<string, string>();
const replayingTerminals = new Set<string>();
const oscArmingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const oscQuietDoneTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastOscActivityAt = new Map<string, number>();
const turnStartAtByTerminal = new Map<string, number>();

// Per-terminal notification cooldown to avoid repeated notifications
// from rapid duplicate OSC title sequences.
const NOTIFICATION_COOLDOWN_MS = 30_000;
const lastNotifiedAt = new Map<string, number>();


const CURSOR_STORAGE_KEY = "bord:terminal-cursors";
const MAX_CURSOR_ENTRIES = 20;
const liveCursorByTerminal = new Map<string, number>();
const textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
const oscTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
const DEV_LOGS = !!(import.meta as any).env?.DEV;
const BACKGROUND_OUTPUT_BUFFER_MAX_BYTES = 2 * 1024 * 1024;

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

function bufferOutput(conn: WsConnection, data: ArrayBuffer | string) {
  conn.bufferedOutput.push(data);
  conn.bufferedBytes += payloadByteLength(data);

  let droppedBytes = 0;
  while (conn.bufferedBytes > BACKGROUND_OUTPUT_BUFFER_MAX_BYTES && conn.bufferedOutput.length > 0) {
    const dropped = conn.bufferedOutput.shift();
    if (!dropped) break;
    const size = payloadByteLength(dropped);
    conn.bufferedBytes = Math.max(0, conn.bufferedBytes - size);
    droppedBytes += size;
  }

  if (droppedBytes > 0) {
    logOsc("background output buffer trimmed", {
      droppedBytes,
      bufferedBytes: conn.bufferedBytes,
    });
  }
}

function flushBufferedOutput(ptyId: string, conn: WsConnection) {
  if (!conn.bufferedOutput.length) return;

  const pending = conn.bufferedOutput;
  conn.bufferedOutput = [];
  conn.bufferedBytes = 0;

  logOsc(`flush buffered output ${ptyId}`, { chunks: pending.length });
  for (const chunk of pending) {
    conn.onData(chunk);
  }
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

function logOsc(message: string, ...rest: unknown[]) {
  if (!DEV_LOGS) return;
  console.log(`[bord][osc] ${message}`, ...rest);
}

function normalizeOscTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function extractOscTitles(data: Uint8Array): string[] {
  const titles: string[] = [];
  if (!oscTextDecoder) return titles;

  for (let i = 0; i < data.length - 4; i++) {
    // ESC ] <0|2> ;
    if (data[i] !== 0x1b || data[i + 1] !== 0x5d) continue;
    const type = data[i + 2];
    if ((type !== 0x30 && type !== 0x32) || data[i + 3] !== 0x3b) continue;

    for (let j = i + 4; j < data.length; j++) {
      const isBel = data[j] === 0x07;
      const isSt = data[j] === 0x1b && data[j + 1] === 0x5c;
      if (!isBel && !isSt) continue;

      if (j > i + 4) {
        const raw = oscTextDecoder.decode(data.subarray(i + 4, j));
        const normalized = normalizeOscTitle(raw);
        if (normalized) titles.push(normalized);
      }

      i = isSt ? j + 1 : j;
      break;
    }
  }

  return titles;
}

function parseGeminiOscState(title: string): OscTurnState {
  const normalized = normalizeOscTitle(title);
  if (!normalized) return "unknown";

  // Gemini CLI emits dynamic icons in title mode:
  //   ✦ active work, ⏲ silent work, ◇ ready, ✋ action required.
  if (normalized.startsWith("✦") || normalized.startsWith("⏲")) return "working";
  if (normalized.startsWith("◇")) return "done";
  if (normalized.startsWith("✋") && /action required/i.test(normalized)) return "done";

  return "unknown";
}

function parseClaudeOscState(title: string): OscTurnState {
  const normalized = normalizeOscTitle(title);
  if (!normalized) return "unknown";

  // Claude uses braille spinner glyphs (U+2800..U+28FF) and sometimes star
  // prefixes while a turn is running.
  if (/^[\u2800-\u28ff]/u.test(normalized)) return "working";
  if (normalized.startsWith("✳") || normalized.startsWith("*") || normalized.startsWith("✶")) {
    return "working";
  }

  // Any non-spinner title is treated as done for Claude.
  return "done";
}

function parseOscTurnState(provider: Provider, title: string): OscTurnState {
  if (provider === "gemini") return parseGeminiOscState(title);
  if (provider === "claude") return parseClaudeOscState(title);
  return "unknown";
}

function clearArmingTimer(ptyId: string) {
  const timer = oscArmingTimers.get(ptyId);
  if (!timer) return;
  clearTimeout(timer);
  oscArmingTimers.delete(ptyId);
}

function clearQuietDoneTimer(ptyId: string) {
  const timer = oscQuietDoneTimers.get(ptyId);
  if (!timer) return;
  clearTimeout(timer);
  oscQuietDoneTimers.delete(ptyId);
}

function scheduleQuietDoneTimer(ptyId: string) {
  const terminal = state.terminals.find((t) => t.id === ptyId);
  if (!terminal?.provider) return;

  const timeoutMs = Math.max(1000, getSettings().idleThresholdMs);
  const expectedActivityAt = lastOscActivityAt.get(ptyId) ?? Date.now();

  clearQuietDoneTimer(ptyId);
  const timer = setTimeout(() => {
    oscQuietDoneTimers.delete(ptyId);

    const current = state.terminals.find((t) => t.id === ptyId);
    if (!current?.provider) return;
    if (!current.notificationsArmed) return;
    if (oscTurnStateByTerminal.get(ptyId) !== "working") return;

    const latestActivityAt = lastOscActivityAt.get(ptyId) ?? 0;
    if (latestActivityAt !== expectedActivityAt) return;

    oscTurnStateByTerminal.set(ptyId, "done");
    turnStartAtByTerminal.delete(ptyId);
    setTerminalWarmupStartedAt(ptyId, undefined);
    setTerminalArmed(ptyId, false);

    logOsc(`quiet-done ${ptyId} after ${timeoutMs}ms without OSC title updates`);
    handleOscDoneEvent(ptyId);
  }, timeoutMs);

  oscQuietDoneTimers.set(ptyId, timer);
}

function scheduleOscArming(ptyId: string, source: "osc" | "input" = "osc") {
  if (oscArmingTimers.has(ptyId)) return;

  const terminal = state.terminals.find((t) => t.id === ptyId);
  if (!terminal?.provider) return;
  if (terminal.notificationsArmed) return;

  const turnStartedAt = turnStartAtByTerminal.get(ptyId);
  if (typeof turnStartedAt !== "number") return;

  const delay = Math.max(0, getSettings().warmupDurationMs);
  if (delay === 0) {
    const lastActivity = lastOscActivityAt.get(ptyId) ?? 0;
    if (lastActivity < turnStartedAt) return;
    setTerminalArmed(ptyId, true);
    if ((oscTurnStateByTerminal.get(ptyId) ?? "unknown") === "working") {
      scheduleQuietDoneTimer(ptyId);
    }
    logOsc(`armed ${ptyId} after 0ms warmup`, { source });
    return;
  }

  const timer = setTimeout(() => {
    oscArmingTimers.delete(ptyId);

    const current = state.terminals.find((t) => t.id === ptyId);
    if (!current?.provider) return;
    if (current.notificationsArmed) return;

    const currentTurnStart = turnStartAtByTerminal.get(ptyId);
    if (currentTurnStart !== turnStartedAt) return;

    // Avoid arming from stale replay or very old title updates.
    const lastActivity = lastOscActivityAt.get(ptyId) ?? 0;
    if (lastActivity < turnStartedAt) {
      setTerminalWarmupStartedAt(ptyId, undefined);
      return;
    }
    if (Date.now() - lastActivity > delay + 1000) {
      setTerminalWarmupStartedAt(ptyId, undefined);
      return;
    }

    setTerminalArmed(ptyId, true);
    if ((oscTurnStateByTerminal.get(ptyId) ?? "unknown") === "working") {
      scheduleQuietDoneTimer(ptyId);
    }
    logOsc(`armed ${ptyId} after ${delay}ms warmup`, { source });
  }, delay);

  oscArmingTimers.set(ptyId, timer);
}

export function handleTerminalOscTitle(ptyId: string, rawTitle: string) {
  const title = normalizeOscTitle(rawTitle);
  if (!title) return;

  if (replayingTerminals.has(ptyId)) return;

  const terminal = state.terminals.find((t) => t.id === ptyId);
  if (!terminal?.provider) return;

  const prevState = oscTurnStateByTerminal.get(ptyId) ?? "unknown";

  lastOscActivityAt.set(ptyId, Date.now());

  // Ignore provider startup/status title noise until the user actually starts
  // a turn in this terminal.
  if (!turnStartAtByTerminal.has(ptyId)) {
    return;
  }

  const lastTitle = lastOscTitleByTerminal.get(ptyId);
  if (lastTitle === title) {
    if (prevState === "working") {
      scheduleQuietDoneTimer(ptyId);
    }
    return;
  }
  lastOscTitleByTerminal.set(ptyId, title);

  const nextState = parseOscTurnState(terminal.provider, title);
  if (nextState === "working" && !terminal.notificationWarmupStartedAt) {
    setTerminalWarmupStartedAt(ptyId, Date.now());
  }
  scheduleOscArming(ptyId, "osc");

  logOsc(`title ${terminal.provider}:${ptyId}`, {
    title,
    prevState,
    nextState,
    armed: !!terminal.notificationsArmed,
  });

  if (nextState === "unknown") {
    if (prevState === "working") {
      scheduleQuietDoneTimer(ptyId);
    }
    return;
  }

  if (nextState === "working") {
    oscTurnStateByTerminal.set(ptyId, "working");
    scheduleQuietDoneTimer(ptyId);
    return;
  }

  clearArmingTimer(ptyId);
  clearQuietDoneTimer(ptyId);
  turnStartAtByTerminal.delete(ptyId);
  setTerminalWarmupStartedAt(ptyId, undefined);
  oscTurnStateByTerminal.set(ptyId, "done");
  if (terminal.notificationsArmed) {
    setTerminalArmed(ptyId, false);
  }

  if (prevState === "working") {
    handleOscDoneEvent(ptyId);
  }
}

export function connectTerminal(
  ptyId: string,
  onData: MessageHandler,
  onStatus: StatusHandler,
  options?: ConnectOptions,
): () => void {
  const existing = connections.get(ptyId);
  if (existing) {
    if (existing.ws.readyState === WebSocket.OPEN || existing.ws.readyState === WebSocket.CONNECTING) {
      existing.onData = onData;
      existing.onStatus = onStatus;
      existing.bufferingOutput = false;
      flushBufferedOutput(ptyId, existing);
      onStatus(existing.ws.readyState === WebSocket.OPEN);

      return () => {
        const conn = connections.get(ptyId);
        if (!conn || conn.ws !== existing.ws) return;

        const cursor = liveCursorByTerminal.get(ptyId);
        if (typeof cursor === "number") {
          saveCursor(ptyId, cursor);
        }

        const terminal = state.terminals.find((t) => t.id === ptyId);
        const keepBackground =
          !!terminal?.provider &&
          (
            (oscTurnStateByTerminal.get(ptyId) ?? "unknown") === "working" ||
            !!terminal.notificationsArmed ||
            turnStartAtByTerminal.has(ptyId)
          );

        if (keepBackground) {
          // Keep provider streams alive in background so OSC completion still
          // works when switching tabs/workspaces.
          conn.onData = noopData;
          conn.onStatus = noopStatus;
          conn.bufferingOutput = true;
          return;
        }

        existing.ws.close();
        connections.delete(ptyId);
        liveCursorByTerminal.delete(ptyId);
        conn.bufferedOutput = [];
        conn.bufferedBytes = 0;

        replayingTerminals.delete(ptyId);
        clearArmingTimer(ptyId);
        clearQuietDoneTimer(ptyId);
        setTerminalWarmupStartedAt(ptyId, undefined);

        const stillExists = state.terminals.some((t) => t.id === ptyId);
        if (!stillExists) {
          lastNotifiedAt.delete(ptyId);
          lastOscTitleByTerminal.delete(ptyId);
          lastOscActivityAt.delete(ptyId);
          turnStartAtByTerminal.delete(ptyId);
          oscTurnStateByTerminal.delete(ptyId);
          oscQuietDoneTimers.delete(ptyId);
        }
      };
    }

    // Stale closed connection — drop and recreate below.
    connections.delete(ptyId);
  }

  // Use stored cursor for replay
  const stored = getStoredCursor(ptyId);
  const initialCursor = Math.max(0, stored?.cursor ?? 0);
  const cursorParam = initialCursor > 0 ? `?cursor=${initialCursor}` : "";
  const url = `${getWsBase()}/ws/pty/${ptyId}${cursorParam}`;
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";
  liveCursorByTerminal.set(ptyId, initialCursor);

  connections.set(ptyId, {
    ws,
    onData,
    onStatus,
    bufferingOutput: false,
    bufferedOutput: [],
    bufferedBytes: 0,
  });

  ws.onopen = () => {
    replayingTerminals.delete(ptyId);
    connections.get(ptyId)?.onStatus(true);
  };
  ws.onclose = () => {
    const conn = connections.get(ptyId);
    if (!conn || conn.ws !== ws) return;
    conn.onStatus(false);

    // If terminal no longer exists, eagerly drop all tracking state.
    const stillExists = state.terminals.some((t) => t.id === ptyId);
    if (!stillExists) {
      connections.delete(ptyId);
      liveCursorByTerminal.delete(ptyId);
      conn.bufferedOutput = [];
      conn.bufferedBytes = 0;
      replayingTerminals.delete(ptyId);
      clearArmingTimer(ptyId);
      clearQuietDoneTimer(ptyId);
      setTerminalWarmupStartedAt(ptyId, undefined);
      lastNotifiedAt.delete(ptyId);
      lastOscTitleByTerminal.delete(ptyId);
      lastOscActivityAt.delete(ptyId);
      turnStartAtByTerminal.delete(ptyId);
      oscTurnStateByTerminal.delete(ptyId);
      oscQuietDoneTimers.delete(ptyId);
    }
  };
  ws.onerror = () => connections.get(ptyId)?.onStatus(false);
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
          replayingTerminals.add(ptyId);
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
          replayingTerminals.delete(ptyId);
          clearArmingTimer(ptyId);
          clearQuietDoneTimer(ptyId);
          setTerminalWarmupStartedAt(ptyId, undefined);
          options?.onReplayDone?.();
          return;
        }
        if (ctrl.type === "idle" || ctrl.type === "active") {
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

    if (event.data instanceof ArrayBuffer) {
      const titles = extractOscTitles(new Uint8Array(event.data));
      for (const title of titles) {
        handleTerminalOscTitle(ptyId, title);
      }
    }

    const conn = connections.get(ptyId);
    if (!conn) return;

    if (conn.bufferingOutput) {
      bufferOutput(conn, event.data);
    } else {
      conn.onData(event.data);
    }
    advanceLiveCursor(ptyId, event.data);
    outputCoalescer.enqueue(ptyId, Date.now());
  };

  // Return cleanup function
  return () => {
    const conn = connections.get(ptyId);
    if (!conn || conn.ws !== ws) return;

    const cursor = liveCursorByTerminal.get(ptyId);
    if (typeof cursor === "number") {
      saveCursor(ptyId, cursor);
    }

    const terminal = state.terminals.find((t) => t.id === ptyId);
    const keepBackground =
      !!terminal?.provider &&
      (
        (oscTurnStateByTerminal.get(ptyId) ?? "unknown") === "working" ||
        !!terminal.notificationsArmed ||
        turnStartAtByTerminal.has(ptyId)
      );

    if (keepBackground) {
      // Keep provider streams alive in background so notifications still fire
      // while user is viewing a different tab/workspace.
      conn.onData = noopData;
      conn.onStatus = noopStatus;
      conn.bufferingOutput = true;
      return;
    }

    ws.close();
    connections.delete(ptyId);
    liveCursorByTerminal.delete(ptyId);
    conn.bufferedOutput = [];
    conn.bufferedBytes = 0;

    replayingTerminals.delete(ptyId);
    clearArmingTimer(ptyId);
    clearQuietDoneTimer(ptyId);
    setTerminalWarmupStartedAt(ptyId, undefined);

    // Preserve OSC state/cooldown across transient unmounts (workspace switches).
    // If the terminal was removed entirely, drop all state.
    const stillExists = state.terminals.some((t) => t.id === ptyId);
    if (!stillExists) {
      lastNotifiedAt.delete(ptyId);
      lastOscTitleByTerminal.delete(ptyId);
      lastOscActivityAt.delete(ptyId);
      turnStartAtByTerminal.delete(ptyId);
      oscTurnStateByTerminal.delete(ptyId);
      oscQuietDoneTimers.delete(ptyId);
    }
  };
}

function handleOscDoneEvent(ptyId: string) {
  const terminal = state.terminals.find((t) => t.id === ptyId);
  if (!terminal) return;

  // Only notify for provider terminals (AI agents), not plain shells
  if (!terminal.provider) return;

  // Respect mute flags
  if (terminal.muted || state.bellMuted) {
    logOsc(`done suppressed ${ptyId}: muted`, {
      terminalMuted: !!terminal.muted,
      globalMuted: !!state.bellMuted,
    });
    return;
  }

  // Per-terminal cooldown to avoid repeated notifications from prompt redraws
  const lastNotified = lastNotifiedAt.get(ptyId) ?? 0;
  if (Date.now() - lastNotified < NOTIFICATION_COOLDOWN_MS) {
    logOsc(`done suppressed ${ptyId}: cooldown`);
    return;
  }

  lastNotifiedAt.set(ptyId, Date.now());

  const isActiveTerminal = state.activeTerminalId === ptyId;
  const isAppFocused = document.hasFocus();
  logOsc(`done notify ${ptyId}`, { isActiveTerminal, isAppFocused });

  addNotification({
    type: "turn-complete",
    terminalId: ptyId,
    workspaceId: terminal.workspaceId,
    provider: terminal.provider,
    title: terminal.customTitle || terminal.sessionTitle || terminal.title || "Terminal",
    body: `${terminal.provider} session turn is complete`,
    isActiveTerminal,
    isAppFocused,
  });
}

export function sendToTerminal(ptyId: string, data: string | Uint8Array) {
  const terminal = state.terminals.find((t) => t.id === ptyId);
  if (terminal?.provider) {
    const currentState = oscTurnStateByTerminal.get(ptyId) ?? "unknown";
    const needsReset =
      currentState !== "unknown" ||
      oscArmingTimers.has(ptyId) ||
      oscQuietDoneTimers.has(ptyId) ||
      !!terminal.notificationsArmed ||
      !!terminal.notificationWarmupStartedAt;

    if (needsReset) {
      turnStartAtByTerminal.delete(ptyId);
      setTerminalWarmupStartedAt(ptyId, undefined);

      if (terminal.notificationsArmed) {
        setTerminalArmed(ptyId, false);
      }
      clearArmingTimer(ptyId);
      clearQuietDoneTimer(ptyId);
      oscTurnStateByTerminal.set(ptyId, "unknown");
      lastOscTitleByTerminal.delete(ptyId);
    }

    if (!turnStartAtByTerminal.has(ptyId)) {
      turnStartAtByTerminal.set(ptyId, Date.now());
      logOsc(`turn start ${terminal.provider}:${ptyId} via input`);
    }
  }

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
