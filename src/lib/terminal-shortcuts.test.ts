import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createRoot } from "solid-js";

// Mock sendToTerminal before importing the module under test
const sentData: string[] = [];
mock.module("./ws", () => ({
  sendToTerminal: (_ptyId: string, data: string) => {
    sentData.push(data);
  },
}));

// Mock api to avoid real HTTP calls from handlePaste
mock.module("./api", () => ({
  api: {},
}));

import { createTerminalKeyHandler } from "./terminal-shortcuts";
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

  test("Cmd+Left sends Home (Ctrl+A)", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "ArrowLeft", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x01");
  });

  test("Cmd+Right sends End (Ctrl+E)", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "ArrowRight", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x05");
  });

  test("Cmd+Up scrolls to top", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "ArrowUp", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(term.calls).toContain("scrollToTop");
  });

  test("Cmd+Down scrolls to bottom", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "ArrowDown", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(term.calls).toContain("scrollToBottom");
  });

  test("Cmd+Backspace sends kill line (Ctrl+U)", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "Backspace", metaKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x15");
  });

  test("Shift+Tab sends escape sequence", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "Tab", shiftKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x1b[Z");
  });

  test("Shift+Enter sends Kitty protocol sequence", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "Enter", shiftKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x1b[13;2u");
  });

  test("Option+Backspace sends delete word back", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "Backspace", altKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x1b\x7f");
  });

  test("Option+d sends delete word forward", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "d", altKey: true });
    const result = handler(e);
    expect(result).toBe(true);
    expect(sentData).toContain("\x1bd");
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

  test("PageUp scrolls up one page", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "PageUp" });
    const result = handler(e);
    expect(result).toBe(true);
    expect(term.calls).toContain("scrollPages(-1)");
  });

  test("PageDown scrolls down one page", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "PageDown" });
    const result = handler(e);
    expect(result).toBe(true);
    expect(term.calls).toContain("scrollPages(1)");
  });

  test("unhandled key returns false (pass through)", () => {
    const term = createMockTerminal();
    const handler = createTerminalKeyHandler("pty-1", term as any);
    const e = makeKeyEvent({ key: "x" });
    const result = handler(e);
    expect(result).toBe(false);
  });
});
