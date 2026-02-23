import { describe, test, expect, mock, beforeEach } from "bun:test";

/**
 * WS handler tests. We mock pty-manager using mock.module since
 * no other test file imports from pty-manager directly except
 * pty-manager.test.ts which uses the _internal exports.
 *
 * Note: This must be placed to not conflict with pty-manager.test.ts.
 * The mock.module here replaces the module used by handler.ts imports.
 */

const mockAttachWs = mock(() => true);
const mockDetachWs = mock(() => {});
const mockWriteToPty = mock(() => true);
const mockResizePty = mock(() => true);
const mockConfigurePty = mock(() => true);

mock.module("../services/pty-manager", () => ({
  attachWs: mockAttachWs,
  detachWs: mockDetachWs,
  writeToPty: mockWriteToPty,
  resizePty: mockResizePty,
  configurePty: mockConfigurePty,
  // Include the _internal exports so pty-manager.test.ts doesn't break
  _createRingBuffer: () => ({ data: new Uint8Array(0), writePos: 0, totalWritten: 0 }),
  _ringWrite: () => {},
  _ringRead: () => null,
  _shellEscape: (s: string) => s,
  _BUFFER_LIMIT: 2 * 1024 * 1024,
  _MAX_REPLAY_BURST: 128 * 1024,
  // Other exports pty.ts imports
  createPty: mock(() => ({ id: "test", cwd: "/" })),
  destroyPty: mock(() => Promise.resolve(true)),
  listPtySessions: mock(() => []),
  getPtySession: mock(() => undefined),
}));

const { handleWsUpgrade, handleWsMessage, handleWsClose } = await import("./handler");

function createMockWs(path: string, query: string = "") {
  const sent: (string | Uint8Array)[] = [];
  let closed = false;
  let closeCode = 0;
  let closeReason = "";

  return {
    data: { path, query },
    readyState: 1,
    send(msg: string) {
      sent.push(msg);
    },
    sendBinary(data: Uint8Array) {
      sent.push(data);
    },
    close(code?: number, reason?: string) {
      closed = true;
      closeCode = code ?? 0;
      closeReason = reason ?? "";
    },
    _sent: sent,
    _isClosed: () => closed,
    _closeCode: () => closeCode,
    _closeReason: () => closeReason,
  };
}

beforeEach(() => {
  mockAttachWs.mockClear();
  mockDetachWs.mockClear();
  mockWriteToPty.mockClear();
  mockResizePty.mockClear();
  mockConfigurePty.mockClear();
  mockAttachWs.mockReturnValue(true);
});

describe("handleWsUpgrade", () => {
  test("attaches to PTY session", () => {
    const ws = createMockWs("/ws/pty/session-123", "cursor=100");
    handleWsUpgrade(ws as any);
    expect(mockAttachWs).toHaveBeenCalled();
    const args = mockAttachWs.mock.calls[0];
    expect(args[0]).toBe("session-123");
    expect(args[2]).toBe(100);
  });

  test("closes with 4004 when PTY not found", () => {
    mockAttachWs.mockReturnValue(false);
    const ws = createMockWs("/ws/pty/nonexistent");
    handleWsUpgrade(ws as any);
    expect(ws._isClosed()).toBe(true);
    expect(ws._closeCode()).toBe(4004);
  });

  test("closes with 4000 for unknown path", () => {
    const ws = createMockWs("/ws/unknown");
    handleWsUpgrade(ws as any);
    expect(ws._isClosed()).toBe(true);
    expect(ws._closeCode()).toBe(4000);
  });

  test("defaults cursor to 0 when not provided", () => {
    const ws = createMockWs("/ws/pty/session-123");
    handleWsUpgrade(ws as any);
    const args = mockAttachWs.mock.calls[0];
    expect(args[2]).toBe(0);
  });
});

describe("handleWsMessage", () => {
  test("binary message writes to PTY", () => {
    const ws = createMockWs("/ws/pty/session-123");
    const data = Buffer.from("hello");
    handleWsMessage(ws as any, data);
    expect(mockWriteToPty).toHaveBeenCalledWith("session-123", data);
  });

  test("resize JSON resizes PTY", () => {
    const ws = createMockWs("/ws/pty/session-123");
    handleWsMessage(ws as any, JSON.stringify({ type: "resize", cols: 120, rows: 40 }));
    expect(mockResizePty).toHaveBeenCalledWith("session-123", 120, 40);
  });

  test("ping JSON responds with pong", () => {
    const ws = createMockWs("/ws/pty/session-123");
    handleWsMessage(ws as any, JSON.stringify({ type: "ping" }));
    expect(ws._sent).toHaveLength(1);
    const pong = JSON.parse(ws._sent[0] as string);
    expect(pong.type).toBe("pong");
  });

  test("configure JSON configures PTY", () => {
    const ws = createMockWs("/ws/pty/session-123");
    handleWsMessage(ws as any, JSON.stringify({ type: "configure", idleThresholdMs: 5000 }));
    expect(mockConfigurePty).toHaveBeenCalledWith("session-123", 5000);
  });

  test("non-JSON string treated as raw input", () => {
    const ws = createMockWs("/ws/pty/session-123");
    handleWsMessage(ws as any, "raw text input");
    expect(mockWriteToPty).toHaveBeenCalledWith("session-123", "raw text input");
  });

  test("ignores messages for non-PTY paths", () => {
    const ws = createMockWs("/ws/other");
    handleWsMessage(ws as any, "hello");
    expect(mockWriteToPty).not.toHaveBeenCalled();
  });
});

describe("handleWsClose", () => {
  test("detaches from PTY session", () => {
    const ws = createMockWs("/ws/pty/session-123");
    handleWsClose(ws as any);
    expect(mockDetachWs).toHaveBeenCalled();
    const args = mockDetachWs.mock.calls[0];
    expect(args[0]).toBe("session-123");
  });

  test("ignores non-PTY paths", () => {
    const ws = createMockWs("/ws/other");
    handleWsClose(ws as any);
    expect(mockDetachWs).not.toHaveBeenCalled();
  });
});
