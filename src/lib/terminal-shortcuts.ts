import type { Terminal } from "ghostty-web";
import { sendToTerminal } from "./ws";
import { api } from "./api";
import { increaseFontSize, decreaseFontSize, resetFontSize } from "../store/settings";

type PtyIdSource = string | (() => string);

function resolvePtyId(source: PtyIdSource): string {
  return typeof source === "function" ? source() : source;
}

/**
 * Creates a key event handler for a terminal instance.
 * Attach via terminal.attachCustomKeyEventHandler(handler).
 *
 * ghostty-web convention: return true = "I handled it, stop" / return false = "pass through"
 */
export function createTerminalKeyHandler(
  ptyIdSource: PtyIdSource,
  terminal: Terminal,
): (e: KeyboardEvent) => boolean {
  return (e: KeyboardEvent): boolean => {
    const meta = e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;

    // --- Shift+Tab fix (ghostty-web bug: sends \t instead of \x1b[Z) ---
    if (e.key === "Tab" && shift && !meta && !alt && !e.ctrlKey) {
      e.preventDefault();
      const ptyId = resolvePtyId(ptyIdSource);
      sendToTerminal(ptyId, "\x1b[Z");
      return true;
    }

    // --- Option (Alt) key sequences for app-level navigation ---
    if (alt && !meta && !e.ctrlKey) {
      switch (e.key) {
        // Option+Arrow Left/Right: navigate terminals (handled by App.tsx global handler)
        case "ArrowLeft":
        case "ArrowRight":
          e.preventDefault();
          return true;
      }
    }

    // --- Cmd key sequences ---
    if (meta && !alt && !e.ctrlKey) {
      switch (e.key) {
        // Cmd+K: Clear terminal
        case "k":
          if (!shift) {
            e.preventDefault();
            terminal.clear();
            const ptyId = resolvePtyId(ptyIdSource);
            sendToTerminal(ptyId, "\x0c");
            return true;
          }
          break;

        // Cmd+L: Send form feed (Ctrl+L)
        case "l":
          if (!shift) {
            e.preventDefault();
            const ptyId = resolvePtyId(ptyIdSource);
            sendToTerminal(ptyId, "\x0c");
            return true;
          }
          break;

        // Cmd+C: Smart copy (copy if selection, else SIGINT)
        case "c":
          if (!shift) {
            e.preventDefault();
            if (terminal.hasSelection()) {
              const text = terminal.getSelection();
              if (text) navigator.clipboard.writeText(text);
              terminal.clearSelection();
            } else {
              const ptyId = resolvePtyId(ptyIdSource);
              sendToTerminal(ptyId, "\x03");
            }
            return true;
          }
          break;

        // Cmd+V: Let native paste event flow through — handled by paste listener
        case "v":
          if (!shift) return false;
          break;

        // Cmd+A: Select all
        case "a":
          if (!shift) {
            e.preventDefault();
            terminal.selectAll();
            return true;
          }
          break;

        // Cmd+= or Cmd+Shift+=: Increase font size
        case "=":
          e.preventDefault();
          increaseFontSize();
          return true;

        // Cmd+-: Decrease font size
        case "-":
          if (!shift) {
            e.preventDefault();
            decreaseFontSize();
            return true;
          }
          break;

        // Cmd+0: Reset font size
        case "0":
          if (!shift) {
            e.preventDefault();
            resetFontSize();
            return true;
          }
          break;
      }
    }

    // Pass through to ghostty-web default handling
    return false;
  };
}

/**
 * Attaches a paste event listener to the terminal container that handles
 * image paste via the native ClipboardEvent.clipboardData — no browser
 * permission prompt.  Text paste is left to ghostty-web's own handler.
 *
 * Returns a cleanup function.
 */
export function createTerminalPasteHandler(
  ptyIdSource: PtyIdSource,
  terminal: Terminal,
  container: HTMLElement,
): () => void {
  const handler = (e: ClipboardEvent) => {
    const cd = e.clipboardData;
    if (!cd) return;

    // Only intercept pure-image paste (no text/plain companion)
    if (cd.types.includes("text/plain")) return;

    const imageItem = Array.from(cd.items).find((item) =>
      item.type.startsWith("image/"),
    );
    if (!imageItem) return;

    e.preventDefault();
    e.stopPropagation();

    const blob = imageItem.getAsFile();
    if (blob) {
      handleImagePaste(ptyIdSource, terminal, blob, imageItem.type);
    }
  };

  // Capture phase so we see the event before ghostty-web's bubble handlers
  container.addEventListener("paste", handler, { capture: true });
  return () => container.removeEventListener("paste", handler, { capture: true });
}

async function handleImagePaste(
  ptyIdSource: PtyIdSource,
  terminal: Terminal,
  blob: Blob,
  mimeType: string,
) {
  try {
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        "",
      ),
    );
    const result = await api.uploadClipboardImage(base64, mimeType);
    terminal.paste(result.path);
  } catch (err) {
    console.error("[bord] clipboard image upload failed:", err);
  }
}
