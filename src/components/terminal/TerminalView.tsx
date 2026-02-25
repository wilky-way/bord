import { onMount, onCleanup, createEffect } from "solid-js";
import { FitAddon, init, Terminal } from "ghostty-web";
import { connectTerminal, sendToTerminal, sendResize } from "../../lib/ws";
import { createTerminalWriter } from "../../lib/terminal-writer";
import { setTerminalConnected } from "../../store/terminals";
import { terminalTheme } from "../../lib/theme";
import { createTerminalKeyHandler } from "../../lib/terminal-shortcuts";
import { createTerminalWheelHandler } from "../../lib/terminal-wheel";
import { createTerminalFileLinkProvider } from "../../lib/terminal-file-links";
import { fontSize, fontFamily } from "../../store/settings";
// Theme is read at terminal creation time — changing themes applies to new terminals only

interface Props {
  ptyId: string;
  onTitleChange?: (title: string) => void;
  onCwdChange?: (cwd: string) => void;
  onFileLinkOpen?: (path: string) => void;
  getCwd?: () => string | undefined;
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
  let wsCleanup: (() => void) | undefined;
  let fitAddon: FitAddon | undefined;
  let writerDispose: (() => void) | undefined;
  let resizeSubscription: { dispose(): void } | undefined;
  let disposed = false;

  const sendCurrentResize = () => {
    if (!terminal) return;
    if (terminal.cols <= 0 || terminal.rows <= 0) return;
    sendResize(props.ptyId, terminal.cols, terminal.rows);
  };

  onMount(() => {
    createEffect(() => {
      const size = fontSize();
      if (!terminal || disposed) return;
      (terminal as any).options.fontSize = size;
      fitAddon?.fit();
    });

    createEffect(() => {
      const family = fontFamily();
      if (!terminal || disposed) return;
      (terminal as any).options.fontFamily = family;
      fitAddon?.fit();
    });

    onCleanup(() => {
      disposed = true;
      writerDispose?.();
      resizeSubscription?.dispose();
      wsCleanup?.();
      fitAddon?.dispose();
      terminal?.dispose();
      terminal = undefined;
    });

    void (async () => {
      await ensureWasm();
      if (disposed) return;

      terminal = new Terminal({
        fontSize: fontSize(),
        fontFamily: fontFamily(),
        cursorStyle: "block",
        cursorBlink: false,
        theme: terminalTheme(),
      });

      terminal.open(containerRef);

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      fitAddon.observeResize();

      if (typeof terminal.attachCustomKeyEventHandler === "function") {
        terminal.attachCustomKeyEventHandler(createTerminalKeyHandler(props.ptyId, terminal));
      }
      if (typeof terminal.attachCustomWheelEventHandler === "function") {
        terminal.attachCustomWheelEventHandler(createTerminalWheelHandler(props.ptyId, terminal));
      }
      if (props.onFileLinkOpen) {
        terminal.registerLinkProvider(createTerminalFileLinkProvider(
          terminal,
          (link) => {
            props.onFileLinkOpen?.(link.path);
          },
          () => props.getCwd?.(),
        ));
      }

      const writer = createTerminalWriter(terminal);
      writerDispose = () => writer.dispose();

      resizeSubscription = terminal.onResize(({ cols, rows }) => {
        if (cols > 0 && rows > 0) {
          sendResize(props.ptyId, cols, rows);
        }
      });

      wsCleanup = connectTerminal(
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
        },
        (connected) => {
          setTerminalConnected(props.ptyId, connected);
          if (!connected || !terminal) return;
          fitAddon?.fit();
          sendCurrentResize();
        },
        {
          onReplayDone: () => {
            if (disposed || !terminal) return;
            requestAnimationFrame(() => {
              if (!disposed && terminal) {
                terminal.scrollToBottom();
              }
            });
          },
        },
      );

      terminal.onData((data: string) => {
        sendToTerminal(props.ptyId, data);
      });

      if (terminal.onTitleChange) {
        terminal.onTitleChange((title: string) => {
          props.onTitleChange?.(title);
        });
      }

      fitAddon.fit();
      sendCurrentResize();
    })();
  });

  return <div ref={containerRef} class="terminal-container" />;
}
