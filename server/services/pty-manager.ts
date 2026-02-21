import type { ServerWebSocket } from "bun";

const BUFFER_LIMIT = 2 * 1024 * 1024; // 2MB circular buffer
const BUFFER_CHUNK = 64 * 1024; // 64KB replay chunks

interface PtySession {
  id: string;
  proc: ReturnType<typeof Bun.spawn>;
  cwd: string;
  buffer: string;
  bufferCursor: number; // bytes trimmed from buffer start (monotonically increasing)
  cursor: number; // absolute byte position of buffer end
  subscribers: Map<ServerWebSocket<{ path: string }>, { cursor: number }>;
}

const sessions = new Map<string, PtySession>();

export function createPty(
  id: string,
  cwd: string = process.env.HOME ?? "/",
  cols: number = 80,
  rows: number = 24,
  command?: string[],
): PtySession {
  const session: PtySession = {
    id,
    proc: null as unknown as ReturnType<typeof Bun.spawn>,
    cwd,
    buffer: "",
    bufferCursor: 0,
    cursor: 0,
    subscribers: new Map(),
  };

  const cmd = command ?? ["zsh", "-l"];

  const { CLAUDECODE, ...cleanEnv } = process.env;

  const proc = Bun.spawn(cmd, {
    cwd,
    env: {
      ...cleanEnv,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    },
    terminal: {
      cols,
      rows,
      data(_terminal, data: Uint8Array) {
        appendToBuffer(session, data);
        for (const [ws, meta] of session.subscribers) {
          if (ws.readyState === 1) {
            ws.sendBinary(data);
            meta.cursor = session.cursor;
          }
        }
      },
      exit() {
        // PTY stream closed - clean up subscribers
        for (const [ws] of session.subscribers) {
          ws.close(1000, "PTY exited");
        }
        session.subscribers.clear();
      },
    },
  });

  session.proc = proc;
  sessions.set(id, session);
  return session;
}

function appendToBuffer(session: PtySession, data: Uint8Array) {
  const text = new TextDecoder().decode(data);
  session.buffer += text;
  session.cursor += data.byteLength;
  if (session.buffer.length > BUFFER_LIMIT) {
    const trim = session.buffer.length - BUFFER_LIMIT;
    session.buffer = session.buffer.slice(trim);
    session.bufferCursor += trim;
  }
}

export function attachWs(
  id: string,
  ws: ServerWebSocket<{ path: string }>,
  clientCursor: number = 0,
): boolean {
  const session = sessions.get(id);
  if (!session) return false;

  session.subscribers.set(ws, { cursor: session.cursor });

  // Replay buffered data if client needs it
  if (clientCursor < session.cursor) {
    const bufferStart = session.bufferCursor;
    const offset = Math.max(0, clientCursor - bufferStart);
    const replay = session.buffer.slice(offset);

    // Send in chunks to avoid overwhelming the WebSocket
    const encoder = new TextEncoder();
    for (let i = 0; i < replay.length; i += BUFFER_CHUNK) {
      const chunk = replay.slice(i, i + BUFFER_CHUNK);
      ws.sendBinary(encoder.encode(chunk));
    }
  }

  // Send current cursor position so client can track
  ws.send(JSON.stringify({ type: "cursor", cursor: session.cursor }));

  return true;
}

export function detachWs(id: string, ws: ServerWebSocket<{ path: string }>) {
  const session = sessions.get(id);
  if (!session) return;
  session.subscribers.delete(ws);
}

export function writeToPty(id: string, data: string | Uint8Array): boolean {
  const session = sessions.get(id);
  if (!session?.proc.terminal) return false;

  session.proc.terminal.write(data);
  return true;
}

export function resizePty(id: string, cols: number, rows: number): boolean {
  const session = sessions.get(id);
  if (!session?.proc.terminal) return false;

  session.proc.terminal.resize(cols, rows);
  return true;
}

export function destroyPty(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;

  for (const [ws] of session.subscribers) {
    ws.close(1000, "PTY destroyed");
  }
  session.subscribers.clear();

  if (session.proc.terminal && !session.proc.terminal.closed) {
    session.proc.terminal.close();
  }
  session.proc.kill();
  sessions.delete(id);
  return true;
}

export function getPtySession(id: string): PtySession | undefined {
  return sessions.get(id);
}

export function listPtySessions(): Array<{ id: string; cwd: string }> {
  return Array.from(sessions.values()).map((s) => ({ id: s.id, cwd: s.cwd }));
}
