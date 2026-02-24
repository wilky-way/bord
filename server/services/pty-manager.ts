import type { ServerWebSocket } from "bun";

const BUFFER_LIMIT = 2 * 1024 * 1024; // 2MB circular buffer
const BUFFER_CHUNK = 64 * 1024; // 64KB replay chunks
const MAX_REPLAY_BURST = 128 * 1024; // 128KB max replay on attach

interface RingBuffer {
  data: Uint8Array; // Pre-allocated 2MB
  writePos: number; // Write head [0, BUFFER_LIMIT)
  totalWritten: number; // Total bytes ever written (monotonically increasing)
}

const DEFAULT_IDLE_THRESHOLD_MS = 8000;

const CWD_POLL_INTERVAL_MS = 3_000;

interface PtySession {
  id: string;
  proc: ReturnType<typeof Bun.spawn>;
  cwd: string;
  ring: RingBuffer;
  subscribers: Map<ServerWebSocket<{ path: string }>, { cursor: number }>;
  idleTimer: Timer | null;
  idleThresholdMs: number;
  isIdle: boolean;
  cwdPollTimer: Timer | null;
  lastKnownCwd: string;
}

function createRingBuffer(): RingBuffer {
  return {
    data: new Uint8Array(BUFFER_LIMIT),
    writePos: 0,
    totalWritten: 0,
  };
}

function ringWrite(ring: RingBuffer, chunk: Uint8Array): void {
  const len = chunk.byteLength;

  if (len >= BUFFER_LIMIT) {
    // Chunk larger than entire buffer -- keep only the tail
    ring.data.set(chunk.subarray(len - BUFFER_LIMIT), 0);
    ring.writePos = 0;
    ring.totalWritten += len;
    return;
  }

  const spaceBeforeWrap = BUFFER_LIMIT - ring.writePos;

  if (len <= spaceBeforeWrap) {
    ring.data.set(chunk, ring.writePos);
    ring.writePos += len;
    if (ring.writePos === BUFFER_LIMIT) ring.writePos = 0;
  } else {
    // Wrap: first part to end, second part from start
    ring.data.set(chunk.subarray(0, spaceBeforeWrap), ring.writePos);
    ring.data.set(chunk.subarray(spaceBeforeWrap), 0);
    ring.writePos = len - spaceBeforeWrap;
  }

  ring.totalWritten += len;
}

function ringRead(ring: RingBuffer, fromCursor: number): Uint8Array | null {
  const bufferStart = Math.max(0, ring.totalWritten - BUFFER_LIMIT);
  const effectiveFrom = Math.max(fromCursor, bufferStart);

  if (effectiveFrom >= ring.totalWritten) return null;

  const bytesToRead = ring.totalWritten - effectiveFrom;
  const result = new Uint8Array(bytesToRead);

  const readStartPos =
    ((ring.writePos - bytesToRead) % BUFFER_LIMIT + BUFFER_LIMIT) %
    BUFFER_LIMIT;

  if (readStartPos + bytesToRead <= BUFFER_LIMIT) {
    result.set(ring.data.subarray(readStartPos, readStartPos + bytesToRead));
  } else {
    // Wraps around
    const firstPart = BUFFER_LIMIT - readStartPos;
    result.set(ring.data.subarray(readStartPos, BUFFER_LIMIT));
    result.set(ring.data.subarray(0, bytesToRead - firstPart), firstPart);
  }

  return result;
}

function shellEscape(arg: string): string {
  if (/^[a-zA-Z0-9_\-./=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

const sessions = new Map<string, PtySession>();

/** Get the current working directory of a process by PID (macOS + Linux). */
async function getProcessCwd(pid: number): Promise<string | null> {
  try {
    if (process.platform === "darwin") {
      const proc = Bun.spawn(["lsof", "-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
        stdout: "pipe",
        stderr: "ignore",
      });
      const text = await new Response(proc.stdout).text();
      // lsof output: lines starting with 'n' contain the path
      for (const line of text.split("\n")) {
        if (line.startsWith("n/")) return line.slice(1);
      }
    } else {
      // Linux: readlink /proc/<pid>/cwd
      const link = await Bun.file(`/proc/${pid}/cwd`).text().catch(() => null);
      if (link) return link.trim();
    }
  } catch {
    // Process may have exited
  }
  return null;
}

function startCwdPolling(session: PtySession) {
  session.cwdPollTimer = setInterval(async () => {
    const pid = session.proc?.pid;
    if (!pid) return;
    const cwd = await getProcessCwd(pid);
    if (cwd && cwd !== session.lastKnownCwd) {
      session.lastKnownCwd = cwd;
      const msg = JSON.stringify({ type: "cwd", path: cwd });
      for (const [ws] of session.subscribers) {
        if (ws.readyState === 1) ws.send(msg);
      }
    }
  }, CWD_POLL_INTERVAL_MS);
}

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
    ring: createRingBuffer(),
    subscribers: new Map(),
    idleTimer: null,
    idleThresholdMs: DEFAULT_IDLE_THRESHOLD_MS,
    isIdle: false,
    cwdPollTimer: null,
    lastKnownCwd: cwd,
  };

  const shell = process.env.SHELL || "zsh";
  const cmd = [shell, "-l"];

  const { CLAUDECODE, ...cleanEnv } = process.env;

  const proc = Bun.spawn(cmd, {
    cwd,
    env: {
      ...cleanEnv,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      TERM_PROGRAM: "ghostty",
    },
    terminal: {
      cols,
      rows,
      data(_terminal, data: Uint8Array) {
        appendToBuffer(session, data);

        // Idle state tracking: clear pending timer, notify active if transitioning
        if (session.idleTimer) {
          clearTimeout(session.idleTimer);
          session.idleTimer = null;
        }
        if (session.isIdle) {
          session.isIdle = false;
          const activeMsg = JSON.stringify({ type: "active" });
          for (const [ws] of session.subscribers) {
            if (ws.readyState === 1) ws.send(activeMsg);
          }
        }

        for (const [ws, meta] of session.subscribers) {
          if (ws.readyState === 1) {
            ws.sendBinary(data);
            meta.cursor = session.ring.totalWritten;
          }
        }

        // Schedule idle detection
        session.idleTimer = setTimeout(() => {
          session.isIdle = true;
          session.idleTimer = null;
          const idleMsg = JSON.stringify({ type: "idle" });
          for (const [ws] of session.subscribers) {
            if (ws.readyState === 1) ws.send(idleMsg);
          }
        }, session.idleThresholdMs);
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

  if (command?.length && proc.terminal) {
    proc.terminal.write(`${command.map(shellEscape).join(" ")}\n`);
  }

  session.proc = proc;
  sessions.set(id, session);
  startCwdPolling(session);
  return session;
}

function appendToBuffer(session: PtySession, data: Uint8Array) {
  ringWrite(session.ring, data);
}

export function attachWs(
  id: string,
  ws: ServerWebSocket<{ path: string }>,
  clientCursor: number = 0,
): boolean {
  const session = sessions.get(id);
  if (!session) return false;

  session.subscribers.set(ws, { cursor: session.ring.totalWritten });

  // Replay buffered data if client needs it
  if (clientCursor < session.ring.totalWritten) {
    const replayStart = Math.max(clientCursor, session.ring.totalWritten - MAX_REPLAY_BURST);
    const replay = ringRead(session.ring, replayStart);
    if (replay) {
      // Send in chunks to avoid overwhelming the WebSocket
      for (let i = 0; i < replay.byteLength; i += BUFFER_CHUNK) {
        const end = Math.min(i + BUFFER_CHUNK, replay.byteLength);
        ws.sendBinary(replay.subarray(i, end));
      }
    }
  }

  // Send current cursor position so client can track
  ws.send(JSON.stringify({ type: "cursor", cursor: session.ring.totalWritten }));

  // Signal end of replay so client can distinguish replay bytes from live output
  ws.send(JSON.stringify({ type: "replay-done" }));

  // Tell the new client the current idle/active state immediately
  if (session.isIdle) {
    ws.send(JSON.stringify({ type: "idle" }));
  } else {
    ws.send(JSON.stringify({ type: "active" }));
  }

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

async function killProcessTree(proc: ReturnType<typeof Bun.spawn>): Promise<void> {
  const pid = proc.pid;
  if (!pid) return;

  try {
    // Kill the entire process group (negative PID)
    process.kill(-pid, "SIGTERM");
  } catch {
    // Process group kill failed — fall back to direct kill
    proc.kill("SIGTERM");
  }

  // Give processes 200ms to clean up, then SIGKILL survivors
  await Bun.sleep(200);

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // Already dead or group doesn't exist — try direct kill
    try { proc.kill("SIGKILL"); } catch {}
  }
}

export async function destroyPty(id: string): Promise<boolean> {
  const session = sessions.get(id);
  if (!session) return false;

  if (session.idleTimer) {
    clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
  if (session.cwdPollTimer) {
    clearInterval(session.cwdPollTimer);
    session.cwdPollTimer = null;
  }

  for (const [ws] of session.subscribers) {
    ws.close(1000, "PTY destroyed");
  }
  session.subscribers.clear();

  if (session.proc.terminal && !session.proc.terminal.closed) {
    session.proc.terminal.close();
  }
  await killProcessTree(session.proc);
  sessions.delete(id);
  return true;
}

export function configurePty(id: string, idleThresholdMs: number): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  session.idleThresholdMs = Math.max(1000, Math.min(30000, idleThresholdMs));
  return true;
}

export function getPtySession(id: string): PtySession | undefined {
  return sessions.get(id);
}

export function listPtySessions(): Array<{ id: string; cwd: string }> {
  return Array.from(sessions.values()).map((s) => ({ id: s.id, cwd: s.cwd }));
}

/** @internal — exported for testing */
export const _createRingBuffer = createRingBuffer;
export const _ringWrite = ringWrite;
export const _ringRead = ringRead;
export const _shellEscape = shellEscape;
export const _BUFFER_LIMIT = BUFFER_LIMIT;
export const _MAX_REPLAY_BURST = MAX_REPLAY_BURST;
