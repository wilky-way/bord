import { onMount, onCleanup, createSignal, createEffect } from "solid-js";
import { init, Terminal } from "ghostty-web";
import { connectTerminal, sendToTerminal, sendResize } from "../../lib/ws";
import { createTerminalWriter } from "../../lib/terminal-writer";
import { setTerminalConnected } from "../../store/terminals";
import { terminalTheme } from "../../lib/theme";
import { createTerminalKeyHandler } from "../../lib/terminal-shortcuts";
import { createTerminalWheelHandler } from "../../lib/terminal-wheel";
import { fontSize, fontFamily } from "../../store/settings";
// Theme is read at terminal creation time — changing themes applies to new terminals only

interface Props {
  ptyId: string;
  onTitleChange?: (title: string) => void;
  onCwdChange?: (cwd: string) => void;
}

/** Scan binary PTY data for OSC 0/2 title sequences (ESC ] 0; <title> BEL) */
function extractOscTitle(data: Uint8Array): string | null {
  for (let i = 0; i < data.length - 4; i++) {
    // ESC ]
    if (data[i] !== 0x1b || data[i + 1] !== 0x5d) continue;
    const type = data[i + 2];
    // OSC 0 or 2, followed by ;
    if ((type !== 0x30 && type !== 0x32) || data[i + 3] !== 0x3b) continue;
    // Find terminator: BEL (0x07) or ST (ESC \)
    for (let j = i + 4; j < data.length; j++) {
      if (data[j] === 0x07 || (data[j] === 0x1b && data[j + 1] === 0x5c)) {
        return j > i + 4 ? new TextDecoder().decode(data.subarray(i + 4, j)) : null;
      }
    }
  }
  return null;
}

/** Scan binary PTY data for OSC 7 CWD sequences (ESC ] 7 ; file://host/path BEL) */
function extractOsc7Cwd(data: Uint8Array): string | null {
  for (let i = 0; i < data.length - 4; i++) {
    // ESC ]
    if (data[i] !== 0x1b || data[i + 1] !== 0x5d) continue;
    // OSC 7, followed by ;
    if (data[i + 2] !== 0x37 || data[i + 3] !== 0x3b) continue;
    // Find terminator: BEL (0x07) or ST (ESC \)
    for (let j = i + 4; j < data.length; j++) {
      if (data[j] === 0x07 || (data[j] === 0x1b && data[j + 1] === 0x5c)) {
        if (j > i + 4) {
          const uri = new TextDecoder().decode(data.subarray(i + 4, j));
          try {
            const url = new URL(uri);
            return decodeURIComponent(url.pathname);
          } catch {
            const match = uri.match(/^file:\/\/[^/]*(\/.*)$/);
            return match ? decodeURIComponent(match[1]) : null;
          }
        }
        return null;
      }
    }
  }
  return null;
}

// WASM init is async and must happen once before any Terminal is created
let wasmReady: Promise<void>;
function ensureWasm(): Promise<void> {
  wasmReady ??= init();
  return wasmReady;
}

export default function TerminalView(props: Props) {
  let containerRef!: HTMLDivElement;
  let terminal: Terminal | undefined;
  let cleanup: (() => void) | undefined;
  let disposed = false;
  const [ready, setReady] = createSignal(false);

  onMount(async () => {
    await ensureWasm();

    terminal = new Terminal({
      fontSize: fontSize(),
      fontFamily: fontFamily(),
      cursorStyle: "block",
      cursorBlink: false,
      theme: terminalTheme(),
    });

    terminal.open(containerRef);

    // Attach keyboard shortcut handler
    if (typeof terminal.attachCustomKeyEventHandler === "function") {
      terminal.attachCustomKeyEventHandler(createTerminalKeyHandler(props.ptyId, terminal));
    }
    if (typeof terminal.attachCustomWheelEventHandler === "function") {
      terminal.attachCustomWheelEventHandler(createTerminalWheelHandler(props.ptyId, terminal));
    }

    setReady(true);

    // Calculate initial dimensions and fit
    fitTerminal(terminal, containerRef, props.ptyId);

    // Set up write batching
    const writer = createTerminalWriter(terminal);
    let initialReplay = true;
    let replayIdleTimer: ReturnType<typeof setTimeout> | undefined;

    // Connect to PTY via WebSocket
    cleanup = connectTerminal(
      props.ptyId,
      (data) => {
        if (data instanceof ArrayBuffer) {
          const bytes = new Uint8Array(data);
          writer.write(bytes);
          // ghostty-web only scans strings for OSC titles, so scan binary ourselves
          if (props.onTitleChange) {
            const title = extractOscTitle(bytes);
            if (title) props.onTitleChange(title);
          }
          if (props.onCwdChange) {
            const cwd = extractOsc7Cwd(bytes);
            if (cwd) props.onCwdChange(cwd);
          }
        } else if (typeof data === "string") {
          writer.write(data);
        }

        if (initialReplay && terminal) {
          clearTimeout(replayIdleTimer);
          replayIdleTimer = setTimeout(() => {
            if (!disposed && terminal) {
              terminal.scrollToBottom();
            }
            initialReplay = false;
          }, 200);
        }
      },
      (connected) => {
        setTerminalConnected(props.ptyId, connected);
        // Send correct dimensions as soon as WS opens
        if (connected && terminal) {
          fitTerminal(terminal, containerRef, props.ptyId);
        }
      },
    );

    // Forward keyboard input to PTY
    terminal.onData((data: string) => {
      sendToTerminal(props.ptyId, data);
    });

    // Track title changes if supported
    if (terminal.onTitleChange) {
      terminal.onTitleChange((title: string) => {
        props.onTitleChange?.(title);
      });
    }

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (!disposed && terminal && ready()) {
        fitTerminal(terminal, containerRef, props.ptyId);
      }
    });
    resizeObserver.observe(containerRef);

    // Reactive font size: update all terminals when fontSize signal changes
    createEffect(() => {
      const size = fontSize();
      if (terminal && !disposed) {
        (terminal as any).options.fontSize = size;
        fitTerminal(terminal, containerRef, props.ptyId);
      }
    });

    // Reactive font family: update all terminals when fontFamily signal changes
    createEffect(() => {
      const family = fontFamily();
      if (terminal && !disposed) {
        (terminal as any).options.fontFamily = family;
        fitTerminal(terminal, containerRef, props.ptyId);
      }
    });

    onCleanup(() => {
      disposed = true;
      clearTimeout(replayIdleTimer);
      writer.dispose();
      resizeObserver.disconnect();
      cleanup?.();
      terminal?.dispose();
      terminal = undefined;
    });
  });

  return <div ref={containerRef} class="terminal-container" />;
}

const LINE_HEIGHT = 1.2;

let cachedMetrics: { cellWidth: number; cellHeight: number; fontSize: number; fontFamily: string } | null = null;

function measureFontMetrics(fontSize: number, fontFam?: string): { cellWidth: number; cellHeight: number } {
  const family = fontFam || "monospace";
  if (cachedMetrics && cachedMetrics.fontSize === fontSize && cachedMetrics.fontFamily === family) {
    return cachedMetrics;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fontSize}px ${family}`;

  const testString = "MMMMMMMMMM";
  const metrics = ctx.measureText(testString);
  const cellWidth = metrics.width / testString.length;

  const cellHeight = Math.ceil(
    metrics.actualBoundingBoxAscent !== undefined
      ? (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) * LINE_HEIGHT
      : fontSize * LINE_HEIGHT
  );

  cachedMetrics = { cellWidth, cellHeight, fontSize, fontFamily: family };
  return cachedMetrics;
}

function fitTerminal(terminal: Terminal, container: HTMLElement, ptyId: string) {
  // Use proposeDimensions if available (xterm.js API compat)
  if (typeof (terminal as any).proposeDimensions === "function") {
    const dims = (terminal as any).proposeDimensions();
    if (dims && dims.cols > 0 && dims.rows > 0) {
      terminal.resize(dims.cols, dims.rows);
      sendResize(ptyId, dims.cols, dims.rows);
      return;
    }
  }

  // Fallback: measure actual font metrics via Canvas API
  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const rendererMetrics = (terminal as any).renderer?.getMetrics?.();
  const fallbackMetrics = measureFontMetrics(fontSize(), fontFamily());
  const cellWidth = rendererMetrics?.width ?? fallbackMetrics.cellWidth;
  const cellHeight = rendererMetrics?.height ?? fallbackMetrics.cellHeight;

  const canvas = container.querySelector("canvas");
  const style = canvas ? getComputedStyle(canvas) : null;
  const paddingX = style
    ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
    : 0;
  const paddingY = style
    ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
    : 0;

  const availableWidth = Math.max(0, rect.width - paddingX);
  const availableHeight = Math.max(0, rect.height - paddingY);

  const newCols = Math.max(2, Math.floor(availableWidth / cellWidth));
  const newRows = Math.max(1, Math.floor(availableHeight / cellHeight));

  if (newCols !== terminal.cols || newRows !== terminal.rows) {
    terminal.resize(newCols, newRows);
  }

  sendResize(ptyId, terminal.cols, terminal.rows);
}
