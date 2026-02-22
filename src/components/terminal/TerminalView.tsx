import { onMount, onCleanup, createSignal } from "solid-js";
import { init, Terminal } from "ghostty-web";
import { connectTerminal, sendToTerminal, sendResize } from "../../lib/ws";
import { createTerminalWriter } from "../../lib/terminal-writer";
import { setTerminalConnected } from "../../store/terminals";
import { terminalTheme } from "../../lib/theme";
// Theme is read at terminal creation time — changing themes applies to new terminals only

interface Props {
  ptyId: string;
  onTitleChange?: (title: string) => void;
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
      fontSize: 13,
      cursorStyle: "block",
      cursorBlink: false,
      theme: terminalTheme(),
    });

    terminal.open(containerRef);
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
          writer.write(new Uint8Array(data));
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

const FONT_SIZE = 13;
const LINE_HEIGHT = 1.2;

let cachedMetrics: { cellWidth: number; cellHeight: number; fontSize: number } | null = null;

function measureFontMetrics(fontSize: number): { cellWidth: number; cellHeight: number } {
  if (cachedMetrics && cachedMetrics.fontSize === fontSize) {
    return cachedMetrics;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fontSize}px monospace`;

  const testString = "MMMMMMMMMM";
  const metrics = ctx.measureText(testString);
  const cellWidth = metrics.width / testString.length;

  const cellHeight = Math.ceil(
    metrics.actualBoundingBoxAscent !== undefined
      ? (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) * LINE_HEIGHT
      : fontSize * LINE_HEIGHT
  );

  cachedMetrics = { cellWidth, cellHeight, fontSize };
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
  const fallbackMetrics = measureFontMetrics(FONT_SIZE);
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
