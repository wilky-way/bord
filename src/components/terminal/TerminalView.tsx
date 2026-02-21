import { onMount, onCleanup, createSignal } from "solid-js";
import { init, Terminal } from "ghostty-web";
import { connectTerminal, sendToTerminal, sendResize } from "../../lib/ws";
import { createTerminalWriter } from "../../lib/terminal-writer";
import { setTerminalConnected } from "../../store/terminals";
import { terminalTheme } from "../../lib/theme";
import {
  registerTerminal,
  unregisterTerminal,
  onTerminalScroll,
} from "./ParallelScroll";

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
      theme: terminalTheme,
    });

    terminal.open(containerRef);
    setReady(true);

    // Calculate initial dimensions and fit
    fitTerminal(terminal, containerRef, props.ptyId);

    // Set up write batching
    const writer = createTerminalWriter(terminal);

    // Connect to PTY via WebSocket
    cleanup = connectTerminal(
      props.ptyId,
      (data) => {
        if (data instanceof ArrayBuffer) {
          writer.write(new Uint8Array(data));
        } else if (typeof data === "string") {
          writer.write(data);
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

    // Register scroll handlers for parallel scroll sync
    if (terminal.onScroll) {
      terminal.onScroll(() => onTerminalScroll(props.ptyId));
    }

    registerTerminal(props.ptyId, {
      getScrollFraction: () => {
        if (!terminal) return 0;
        const buf = (terminal as any).buffer?.active;
        if (!buf) return 0;
        const maxScroll = buf.length - (terminal as any).rows;
        return maxScroll > 0 ? buf.viewportY / maxScroll : 0;
      },
      setScrollFraction: (fraction: number) => {
        if (!terminal) return;
        const buf = (terminal as any).buffer?.active;
        if (!buf) return;
        const maxScroll = buf.length - (terminal as any).rows;
        const line = Math.round(fraction * maxScroll);
        if (typeof (terminal as any).scrollToLine === "function") {
          (terminal as any).scrollToLine(line);
        }
      },
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (!disposed && terminal && ready()) {
        fitTerminal(terminal, containerRef, props.ptyId);
      }
    });
    resizeObserver.observe(containerRef);

    onCleanup(() => {
      disposed = true;
      writer.dispose();
      unregisterTerminal(props.ptyId);
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
// Monospace character width is ~0.6x the font size
const CHAR_WIDTH_RATIO = 0.6;

function fitTerminal(terminal: Terminal, container: HTMLElement, ptyId: string) {
  // Use proposeDimensions if available (xterm.js API compat)
  if (typeof (terminal as any).proposeDimensions === "function") {
    const dims = (terminal as any).proposeDimensions();
    if (dims) {
      terminal.resize(dims.cols, dims.rows);
      sendResize(ptyId, dims.cols, dims.rows);
      return;
    }
  }

  // Manual calculation from container size and font metrics
  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const cellWidth = Math.floor(FONT_SIZE * CHAR_WIDTH_RATIO);
  const cellHeight = Math.ceil(FONT_SIZE * LINE_HEIGHT);
  const padding = 8; // 4px padding on each side

  const newCols = Math.max(2, Math.floor((rect.width - padding) / cellWidth));
  const newRows = Math.max(1, Math.floor((rect.height - padding) / cellHeight));

  if (newCols !== terminal.cols || newRows !== terminal.rows) {
    terminal.resize(newCols, newRows);
  }

  sendResize(ptyId, terminal.cols, terminal.rows);
}
