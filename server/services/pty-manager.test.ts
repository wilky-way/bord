import { describe, test, expect } from "bun:test";
import {
  _createRingBuffer as createRingBuffer,
  _ringWrite as ringWrite,
  _ringRead as ringRead,
  _shellEscape as shellEscape,
  _BUFFER_LIMIT as BUFFER_LIMIT,
  _MAX_REPLAY_BURST as MAX_REPLAY_BURST,
} from "./pty-manager";

describe("ringWrite / ringRead", () => {
  test("small write and read back", () => {
    const ring = createRingBuffer();
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    ringWrite(ring, data);

    expect(ring.totalWritten).toBe(5);
    expect(ring.writePos).toBe(5);

    const result = ringRead(ring, 0);
    expect(result).not.toBeNull();
    expect(Array.from(result!)).toEqual([1, 2, 3, 4, 5]);
  });

  test("multiple small writes accumulate", () => {
    const ring = createRingBuffer();
    ringWrite(ring, new Uint8Array([10, 20]));
    ringWrite(ring, new Uint8Array([30, 40, 50]));

    expect(ring.totalWritten).toBe(5);
    const result = ringRead(ring, 0);
    expect(Array.from(result!)).toEqual([10, 20, 30, 40, 50]);
  });

  test("read with partial cursor returns remaining data", () => {
    const ring = createRingBuffer();
    ringWrite(ring, new Uint8Array([1, 2, 3, 4, 5]));

    const result = ringRead(ring, 3);
    expect(result).not.toBeNull();
    expect(Array.from(result!)).toEqual([4, 5]);
  });

  test("exact boundary wraparound", () => {
    const ring = createRingBuffer();
    // Write exactly BUFFER_LIMIT bytes
    const full = new Uint8Array(BUFFER_LIMIT);
    full.fill(42);
    ringWrite(ring, full);

    expect(ring.totalWritten).toBe(BUFFER_LIMIT);
    expect(ring.writePos).toBe(0); // wrapped around

    const result = ringRead(ring, 0);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(BUFFER_LIMIT);
    expect(result![0]).toBe(42);
  });

  test("oversized chunk keeps only tail", () => {
    const ring = createRingBuffer();
    const oversized = new Uint8Array(BUFFER_LIMIT + 100);
    for (let i = 0; i < oversized.length; i++) oversized[i] = i % 256;
    ringWrite(ring, oversized);

    expect(ring.totalWritten).toBe(BUFFER_LIMIT + 100);
    expect(ring.writePos).toBe(0);

    const result = ringRead(ring, 0);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(BUFFER_LIMIT);
    // Should contain the last BUFFER_LIMIT bytes of the oversized chunk
    expect(result![0]).toBe(oversized[100]);
  });

  test("sequential wrap: write past buffer boundary", () => {
    const ring = createRingBuffer();
    // Fill to near the end
    const first = new Uint8Array(BUFFER_LIMIT - 10);
    first.fill(1);
    ringWrite(ring, first);

    // Write 20 bytes to wrap around
    const second = new Uint8Array(20);
    second.fill(2);
    ringWrite(ring, second);

    expect(ring.totalWritten).toBe(BUFFER_LIMIT + 10);

    // Read from the start of what's still available
    const bufferStart = ring.totalWritten - BUFFER_LIMIT;
    const result = ringRead(ring, bufferStart);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(BUFFER_LIMIT);
  });

  test("cursor in future returns null", () => {
    const ring = createRingBuffer();
    ringWrite(ring, new Uint8Array([1, 2, 3]));

    const result = ringRead(ring, 100);
    expect(result).toBeNull();
  });

  test("cursor behind buffer start reads from effective start", () => {
    const ring = createRingBuffer();
    // Write more than buffer can hold
    const first = new Uint8Array(BUFFER_LIMIT);
    first.fill(1);
    ringWrite(ring, first);

    const second = new Uint8Array(100);
    second.fill(2);
    ringWrite(ring, second);

    // Cursor 0 is behind buffer start (which is 100)
    const result = ringRead(ring, 0);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(BUFFER_LIMIT);
  });

  test("empty ring returns null for any cursor", () => {
    const ring = createRingBuffer();
    expect(ringRead(ring, 0)).toBeNull();
  });
});

describe("MAX_REPLAY_BURST", () => {
  test("constant is 128KB", () => {
    expect(MAX_REPLAY_BURST).toBe(128 * 1024);
  });
});

describe("shellEscape", () => {
  test("returns safe strings unchanged", () => {
    expect(shellEscape("hello")).toBe("hello");
    expect(shellEscape("path/to/file.ts")).toBe("path/to/file.ts");
    expect(shellEscape("--flag=value")).toBe("--flag=value");
    expect(shellEscape("user@host:path")).toBe("user@host:path");
  });

  test("quotes strings with spaces", () => {
    expect(shellEscape("hello world")).toBe("'hello world'");
  });

  test("escapes single quotes", () => {
    expect(shellEscape("it's")).toBe("'it'\\''s'");
  });

  test("quotes strings with special characters", () => {
    expect(shellEscape("foo$bar")).toBe("'foo$bar'");
    expect(shellEscape("foo;bar")).toBe("'foo;bar'");
    expect(shellEscape("foo|bar")).toBe("'foo|bar'");
    expect(shellEscape("foo&bar")).toBe("'foo&bar'");
  });

  test("handles empty string", () => {
    expect(shellEscape("")).toBe("''");
  });
});
