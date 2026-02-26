import { beforeEach, describe, expect, mock, test } from "bun:test";

const sentData: string[] = [];
mock.module("./ws", () => ({
  sendToTerminal: (_ptyId: string, data: string) => {
    sentData.push(data);
  },
}));

import { createTerminalWheelHandler } from "./terminal-wheel";

function createMockTerminal(overrides: Record<string, unknown> = {}) {
  const rect = {
    left: 10,
    top: 20,
    width: 500,
    height: 200,
    right: 510,
    bottom: 220,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  } as DOMRect;

  return {
    cols: 100,
    rows: 20,
    buffer: {
      active: {
        type: "alternate",
        cursorX: 0,
        cursorY: 0,
      },
    },
    hasMouseTracking: () => true,
    getMode: (mode: number) => mode === 1006,
    renderer: {
      getMetrics: () => ({ width: 5, height: 10 }),
    },
    element: {
      getBoundingClientRect: () => rect,
    },
    ...overrides,
  };
}

function makeWheelEvent(overrides: Record<string, unknown> = {}): WheelEvent {
  return {
    deltaX: 0,
    deltaY: -10,
    deltaMode: 0,
    clientX: 15,
    clientY: 25,
    ...overrides,
  } as WheelEvent;
}

describe("createTerminalWheelHandler", () => {
  beforeEach(() => {
    sentData.length = 0;
  });

  test("passes through when not in alternate screen", () => {
    const terminal = createMockTerminal({
      buffer: {
        active: {
          type: "normal",
          cursorX: 0,
          cursorY: 0,
        },
      },
    });
    const handler = createTerminalWheelHandler("pty-1", terminal as any);

    const handled = handler(makeWheelEvent());

    expect(handled).toBe(false);
    expect(sentData).toHaveLength(0);
  });

  test("passes through when mouse tracking is disabled", () => {
    const terminal = createMockTerminal({ hasMouseTracking: () => false });
    const handler = createTerminalWheelHandler("pty-1", terminal as any);

    const handled = handler(makeWheelEvent());

    expect(handled).toBe(false);
    expect(sentData).toHaveLength(0);
  });

  test("passes through when horizontal wheel dominates", () => {
    const terminal = createMockTerminal();
    const handler = createTerminalWheelHandler("pty-1", terminal as any);

    const handled = handler(makeWheelEvent({ deltaX: 80, deltaY: 5 }));

    expect(handled).toBe(false);
    expect(sentData).toHaveLength(0);
  });

  test("passes through when vertical delta is zero", () => {
    const terminal = createMockTerminal();
    const handler = createTerminalWheelHandler("pty-1", terminal as any);

    const handled = handler(makeWheelEvent({ deltaX: 80, deltaY: 0 }));

    expect(handled).toBe(false);
    expect(sentData).toHaveLength(0);
  });

  test("sends SGR wheel sequence with terminal coordinates", () => {
    const terminal = createMockTerminal();
    const handler = createTerminalWheelHandler("pty-1", terminal as any);

    const handled = handler(makeWheelEvent({ deltaY: -10, clientX: 15, clientY: 25 }));

    expect(handled).toBe(true);
    expect(sentData).toEqual(["\x1b[<64;2;1M"]);
  });

  test("sends X10 wheel sequence when SGR mode is disabled", () => {
    const terminal = createMockTerminal({ getMode: () => false });
    const handler = createTerminalWheelHandler("pty-1", terminal as any);

    const handled = handler(makeWheelEvent({ deltaY: 10, clientX: 20, clientY: 35 }));

    expect(handled).toBe(true);
    expect(sentData).toHaveLength(1);

    const seq = sentData[0];
    expect(seq.charCodeAt(0)).toBe(27);
    expect(seq.charCodeAt(1)).toBe(91);
    expect(seq.charCodeAt(2)).toBe(77);
    expect(seq.charCodeAt(3)).toBe(97); // button 65 => 'a'
    expect(seq.charCodeAt(4)).toBe(35); // col 3 => '#'
    expect(seq.charCodeAt(5)).toBe(34); // row 2 => '"'
  });

  test("clamps repeat count for large wheel deltas", () => {
    const terminal = createMockTerminal();
    const handler = createTerminalWheelHandler("pty-1", terminal as any);

    const handled = handler(makeWheelEvent({ deltaY: 2000 }));

    expect(handled).toBe(true);
    expect(sentData).toHaveLength(5);
    expect(new Set(sentData)).toEqual(new Set(["\x1b[<65;2;1M"]));
  });

  test("clamps wheel coordinates to terminal bounds", () => {
    const terminal = createMockTerminal();
    const handler = createTerminalWheelHandler("pty-1", terminal as any);

    const handled = handler(makeWheelEvent({ clientX: 9999, clientY: -9999 }));

    expect(handled).toBe(true);
    expect(sentData).toEqual(["\x1b[<64;100;1M"]);
  });
});
