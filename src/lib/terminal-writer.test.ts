import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createTerminalWriter } from "./terminal-writer";

// Track rAF / setTimeout scheduling
let rafCallbacks: (() => void)[] = [];
let timeoutCallbacks: (() => void)[] = [];
let nextRafId = 1;
let nextTimerId = 1;

function installRafMock() {
  rafCallbacks = [];
  nextRafId = 1;
  (globalThis as any).requestAnimationFrame = (cb: () => void) => {
    rafCallbacks.push(cb);
    return nextRafId++;
  };
  (globalThis as any).cancelAnimationFrame = (id: number) => {
    // Simplified: clear all (tests only ever have one pending)
    rafCallbacks = [];
  };
}

function installTimeoutFallback() {
  // Remove rAF so the writer falls back to setTimeout
  delete (globalThis as any).requestAnimationFrame;
  delete (globalThis as any).cancelAnimationFrame;

  timeoutCallbacks = [];
  nextTimerId = 1;
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.setTimeout = (cb: () => void, _ms: number) => {
    timeoutCallbacks.push(cb);
    return nextTimerId++;
  };
  (globalThis as any).window.clearTimeout = (_id: number) => {
    timeoutCallbacks = [];
  };
}

function flushRaf() {
  const cbs = rafCallbacks.splice(0);
  cbs.forEach((cb) => cb());
}

function flushTimeouts() {
  const cbs = timeoutCallbacks.splice(0);
  cbs.forEach((cb) => cb());
}

function createMockTerminal() {
  const writes: (string | Uint8Array)[] = [];
  return {
    writes,
    write(data: string | Uint8Array) {
      writes.push(data);
    },
  };
}

describe("createTerminalWriter", () => {
  beforeEach(() => {
    installRafMock();
  });

  test("write queues data for async flush", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    writer.write("hello");
    // Data should NOT be written synchronously
    expect(term.writes.length).toBe(0);
    // After flushing the scheduled rAF, data appears
    flushRaf();
    expect(term.writes).toEqual(["hello"]);
    writer.dispose();
  });

  test("flush writes queued data to terminal", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    writer.write("a");
    writer.write("b");
    writer.write("c");
    flushRaf();
    expect(term.writes).toEqual(["a", "b", "c"]);
    writer.dispose();
  });

  test("flush respects MAX_CHUNKS limit (32 per frame)", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    // Write 40 small chunks
    for (let i = 0; i < 40; i++) writer.write(`chunk${i}`);
    flushRaf();
    // Only 32 should have been written in the first frame
    expect(term.writes.length).toBe(32);
    // Second frame picks up the rest
    flushRaf();
    expect(term.writes.length).toBe(40);
    writer.dispose();
  });

  test("flush respects MAX_BYTES limit (64KB per frame)", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    // Each chunk is 32KB, so two fit in a 64KB frame and the third spills
    const bigChunk = "x".repeat(32 * 1024);
    writer.write(bigChunk);
    writer.write(bigChunk);
    writer.write(bigChunk);
    flushRaf();
    // Two chunks = 64KB => exactly at limit; third is deferred
    expect(term.writes.length).toBe(2);
    flushRaf();
    expect(term.writes.length).toBe(3);
    writer.dispose();
  });

  test("multi-frame scheduling for large writes", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    for (let i = 0; i < 64; i++) writer.write(`item${i}`);
    // Frame 1: 32 chunks
    flushRaf();
    expect(term.writes.length).toBe(32);
    // Frame 2: remaining 32
    flushRaf();
    expect(term.writes.length).toBe(64);
    // No more frames needed
    expect(rafCallbacks.length).toBe(0);
    writer.dispose();
  });

  test("dispose cleans up pending frames", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    writer.write("data");
    // A rAF is now scheduled
    expect(rafCallbacks.length).toBe(1);
    writer.dispose();
    // Flushing after dispose should not write anything
    flushRaf();
    expect(term.writes.length).toBe(0);
  });

  test("dispose prevents further writes", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    writer.dispose();
    writer.write("should be ignored");
    flushRaf();
    expect(term.writes.length).toBe(0);
  });

  test("rAF fallback to setTimeout", () => {
    installTimeoutFallback();
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    writer.write("timeout-data");
    expect(term.writes.length).toBe(0);
    flushTimeouts();
    expect(term.writes).toEqual(["timeout-data"]);
    writer.dispose();
    // Restore rAF for other tests
    installRafMock();
  });

  test("empty queue flush is a no-op", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    // No writes, no rAF scheduled
    expect(rafCallbacks.length).toBe(0);
    expect(term.writes.length).toBe(0);
    writer.dispose();
  });

  test("write after dispose is a no-op", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    writer.write("before");
    flushRaf();
    expect(term.writes).toEqual(["before"]);
    writer.dispose();
    writer.write("after");
    flushRaf();
    // Only "before" should be present
    expect(term.writes).toEqual(["before"]);
  });

  test("rapid writes are batched into one frame", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    writer.write("a");
    writer.write("b");
    writer.write("c");
    // Only one rAF should be scheduled despite multiple writes
    expect(rafCallbacks.length).toBe(1);
    flushRaf();
    expect(term.writes).toEqual(["a", "b", "c"]);
    writer.dispose();
  });

  test("Uint8Array data is written correctly", () => {
    const term = createMockTerminal();
    const writer = createTerminalWriter(term);
    const buf = new Uint8Array([72, 101, 108, 108, 111]);
    writer.write(buf);
    flushRaf();
    expect(term.writes.length).toBe(1);
    expect(term.writes[0]).toEqual(buf);
    writer.dispose();
  });
});
