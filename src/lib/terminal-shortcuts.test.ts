import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createRoot } from "solid-js";

// Mock sendToTerminal before importing the module under test
const sentData: string[] = [];
mock.module("./ws", () => ({
  sendToTerminal: (_ptyId: string, data: string) => {
    sentData.push(data);
  },
}));

// Mock api — provide uploadClipboardImage for paste handler tests
const uploadedImages: { base64: string; type: string }[] = [];
mock.module("./api", () => ({
  api: {
    uploadClipboardImage: (base64: string, type: string) => {
      uploadedImages.push({ base64, type });
      return Promise.resolve({ path: "/tmp/bord-paste/image.png" });
    },
  },
}));

import { createTerminalKeyHandler, createTerminalPasteHandler } from "./terminal-shortcuts";
import { fontSize, resetFontSize } from "../store/settings";

// Create a mock terminal object matching the subset of Terminal API used by the handler
function createMockTerminal() {
  const calls: string[] = [];
  let hasSelectionVal = false;
  let selectionText = "";
  return {
    calls,
    setSelection(has: boolean, text: string) {
      hasSelectionVal = has;
      selectionText = text;
    },
    clear: () => calls.push("clear"),
    hasSelection: () => hasSelectionVal,
    getSelection: () => selectionText,
    clearSelection: () => calls.push("clearSelection"),
    selectAll: () => calls.push("selectAll"),
    scrollToTop: () => calls.push("scrollToTop"),
    scrollToBottom: () => calls.push("scrollToBottom"),
    scrollPages: (n: number) => calls.push(`scrollPages(${n})`),
    paste: (t: string) => calls.push(`paste(${t})`),
  };
}

function makeKeyEvent(opts: {
  key: string;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
}) {
  let defaultPrevented = false;
  return {
    key: opts.key,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    preventDefault: () => { defaultPrevented = true; },
    get defaultPrevented() { return defaultPrevented; },
  } as unknown as KeyboardEvent;
}

describe("createTerminalKeyHandler", () => {
  beforeEach(() => {
    sentData.length = 0;
  });

  test("Cmd+K clears terminal and sends form feed", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "k", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(term.calls).toContain("clear");
    expect(sentData).toContain("\x0c");
  });

  test("Cmd+L sends form feed", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "l", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x0c");
  });

  test("Cmd+C without selection sends SIGINT", () => {
    const term = createMockTerminal();
    term.setSelection(false, "");
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "c", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x03");
  });

  test("Cmd+C with selection copies text and clears selection", () => {
    const term = createMockTerminal();
    term.setSelection(true, "selected text");

    // Mock navigator.clipboard
    let clipboardText = "";
    (globalThis as any).navigator = {
      clipboard: {
        writeText: (t: string) => { clipboardText = t; return Promise.resolve(); },
        readText: () => Promise.resolve(""),
        read: () => Promise.resolve([]),
      },
    };

    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "c", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(clipboardText).toBe("selected text");
    expect(term.calls).toContain("clearSelection");
    // Should NOT send SIGINT
    expect(sentData).not.toContain("\x03");
  });

  test("Cmd+A selects all", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "a", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(term.calls).toContain("selectAll");
  });

  test("Shift+Tab sends escape sequence", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "Tab", shiftKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x1b[Z");
  });

  test("Option+ArrowLeft is handled (terminal navigation)", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "ArrowLeft", altKey: true });
    const result = handler(e);
    expect(result).toBe(true);
  });

  test("Option+ArrowRight is handled (terminal navigation)", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "ArrowRight", altKey: true });
    const result = handler(e);
    expect(result).toBe(true);
  });

  test("Cmd+= increases font size", () => {
    createRoot((dispose) => {
      resetFontSize(); // 13
      const term = createMockTerminal();
      const handler = createTerminalKeyHandler("pty-1", term as any);
      const e = makeKeyEvent({ key: "=", metaKey: true });
      const result = handler(e);
      expect(result).toBe(true);
      expect(fontSize()).toBe(14);
      dispose();
    });
  });

  test("Cmd+- decreases font size", () => {
    createRoot((dispose) => {
      resetFontSize(); // 13
      const term = createMockTerminal();
      const handler = createTerminalKeyHandler("pty-1", term as any);
      const e = makeKeyEvent({ key: "-", metaKey: true });
      const result = handler(e);
      expect(result).toBe(true);
      expect(fontSize()).toBe(12);
      dispose();
    });
  });

  test("Cmd+0 resets font size", () => {
    createRoot((dispose) => {
      // Change font size first
      const term = createMockTerminal();
      const handler = createTerminalKeyHandler("pty-1", term as any);
      handler(makeKeyEvent({ key: "=", metaKey: true }));
      handler(makeKeyEvent({ key: "=", metaKey: true }));

      const e = makeKeyEvent({ key: "0", metaKey: true });
      const result = handler(e);
      expect(result).toBe(true);
      expect(fontSize()).toBe(13);
      dispose();
    });
  });

  test("Cmd+V passes through (handled by paste event listener)", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "v", metaKey: true });
    const result = handler(e);
    expect(result).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  test("unhandled key returns false (pass through)", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "x" });
    const result = handler(e);
    expect(result).toBe(false);
  });
});

describe("createTerminalPasteHandler", () => {
  beforeEach(() => {
    uploadedImages.length = 0;
  });

  // Minimal mock container — bun test has no DOM
  function createMockContainer() {
    const listeners: Map<string, Array<(e: any) => void>> = new Map();
    return {
      listeners,
      addEventListener(type: string, fn: any, _opts?: any) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type)!.push(fn);
      },
      removeEventListener(type: string, fn: any, _opts?: any) {
        const arr = listeners.get(type);
        if (arr) {
          const idx = arr.indexOf(fn);
          if (idx >= 0) arr.splice(idx, 1);
        }
      },
    } as unknown as HTMLElement & { listeners: Map<string, Array<(e: any) => void>> };
  }

  function makePasteEvent(opts: {
    types: string[];
    items: Array<{ type: string; getAsFile: () => Blob | null }>;
  }) {
    let defaultPrevented = false;
    let propagationStopped = false;
    return {
      clipboardData: {
        types: opts.types,
        items: opts.items,
      },
      preventDefault: () => { defaultPrevented = true; },
      stopPropagation: () => { propagationStopped = true; },
      get defaultPrevented() { return defaultPrevented; },
      get propagationStopped() { return propagationStopped; },
    } as unknown as ClipboardEvent & { propagationStopped: boolean };
  }

  test("image paste is intercepted and uploaded", async () => {
    const term = createMockTerminal();
    const container = createMockContainer();
    const cleanup = createTerminalPasteHandler("pty-1", term as any, container);

    const imageBlob = new Blob([new Uint8Array([0x89, 0x50])], { type: "image/png" });
    const e = makePasteEvent({
      types: ["image/png"],
      items: [{ type: "image/png", getAsFile: () => imageBlob }],
    });

    const handlers = container.listeners.get("paste") ?? [];
    expect(handlers.length).toBe(1);
    handlers[0](e);

    expect(e.defaultPrevented).toBe(true);
    expect(e.propagationStopped).toBe(true);

    // Wait for async image upload
    await new Promise((r) => setTimeout(r, 50));
    expect(uploadedImages.length).toBe(1);
    expect(uploadedImages[0].type).toBe("image/png");
    expect(term.calls).toContain("paste(/tmp/bord-paste/image.png)");

    cleanup();
  });

  test("text paste is not intercepted (left to ghostty-web)", () => {
    const term = createMockTerminal();
    const container = createMockContainer();
    const cleanup = createTerminalPasteHandler("pty-1", term as any, container);

    const e = makePasteEvent({
      types: ["text/plain"],
      items: [{ type: "text/plain", getAsFile: () => null }],
    });

    const handlers = container.listeners.get("paste") ?? [];
    handlers[0](e);

    expect(e.defaultPrevented).toBe(false);
    expect(e.propagationStopped).toBe(false);

    cleanup();
  });

  test("cleanup removes the listener", () => {
    const term = createMockTerminal();
    const container = createMockContainer();
    const cleanup = createTerminalPasteHandler("pty-1", term as any, container);

    expect(container.listeners.get("paste")?.length).toBe(1);
    cleanup();
    expect(container.listeners.get("paste")?.length).toBe(0);
  });
});
