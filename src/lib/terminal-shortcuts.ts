import type { Terminal } from "ghostty-web";
import { sendToTerminal } from "./ws";
import { api } from "./api";
import { increaseFontSize, decreaseFontSize, resetFontSize } from "../store/settings";

/**
 * Creates a key event handler for a terminal instance.
 * Attach via terminal.attachCustomKeyEventHandler(handler).
 *
 * ghostty-web convention: return true = "I handled it, stop" / return false = "pass through"
 */
export function createTerminalKeyHandler(
  ptyId: string,
  terminal: Terminal,
): (e: KeyboardEvent) => boolean {
  return (e: KeyboardEvent): boolean => {
    const meta = e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;

    // --- Shift+Tab fix (ghostty-web bug: sends \t instead of \x1b[Z) ---
    if (e.key === "Tab" && shift && !meta && !alt && !e.ctrlKey) {
      e.preventDefault();
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
            sendToTerminal(ptyId, "\x0c");
            return true;
          }
          break;

        // Cmd+L: Send form feed (Ctrl+L)
        case "l":
          if (!shift) {
            e.preventDefault();
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
              sendToTerminal(ptyId, "\x03");
            }
            return true;
          }
          break;

        // Cmd+V: Paste with bracketed paste support + image paste
        case "v":
          if (!shift) {
            e.preventDefault();
            handlePaste(ptyId, terminal);
            return true;
          }
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

async function handlePaste(ptyId: string, terminal: Terminal) {
  try {
    const items = await navigator.clipboard.read();
    let pastedText = false;

    for (const item of items) {
      // Check for image types first
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (imageType && !item.types.includes("text/plain")) {
        const blob = await item.getType(imageType);
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
        );
        try {
          const result = await api.uploadClipboardImage(base64, imageType);
          terminal.paste(result.path);
        } catch (err) {
          console.error("[bord] clipboard image upload failed:", err);
        }
        pastedText = true;
        continue;
      }

      // Text paste with bracketed paste
      if (item.types.includes("text/plain")) {
        const blob = await item.getType("text/plain");
        const text = await blob.text();
        if (text) {
          terminal.paste(text); // Uses bracketed paste (\x1b[200~...\x1b[201~)
          pastedText = true;
        }
      }
    }

    // Fallback: if clipboard.read() returned nothing useful, try readText()
    if (!pastedText) {
      const text = await navigator.clipboard.readText();
      if (text) terminal.paste(text);
    }
  } catch {
    // Fallback for browsers that don't support clipboard.read()
    try {
      const text = await navigator.clipboard.readText();
      if (text) terminal.paste(text);
    } catch (err) {
      console.error("[bord] clipboard read failed:", err);
    }
  }
}
