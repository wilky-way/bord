import { createSignal } from "solid-js";

const FONT_SIZE_KEY = "bord:font-size";
const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 24;

function loadFontSize(): number {
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (n >= MIN_FONT_SIZE && n <= MAX_FONT_SIZE) return n;
    }
  } catch {}
  return DEFAULT_FONT_SIZE;
}

const [fontSize, setFontSizeRaw] = createSignal(loadFontSize());

function setFontSize(size: number) {
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  setFontSizeRaw(clamped);
  localStorage.setItem(FONT_SIZE_KEY, String(clamped));
}

export { fontSize };

export function increaseFontSize() {
  setFontSize(fontSize() + 1);
}

export function decreaseFontSize() {
  setFontSize(fontSize() - 1);
}

export function resetFontSize() {
  setFontSize(DEFAULT_FONT_SIZE);
}

// Global settings panel open state (so Cmd+, can open it from anywhere)
const [settingsOpen, setSettingsOpen] = createSignal(false);
export { settingsOpen, setSettingsOpen };
