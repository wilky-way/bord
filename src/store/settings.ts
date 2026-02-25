import { createSignal } from "solid-js";
import type { FileIconPackId } from "../lib/file-icons";

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

// Font family
const FONT_FAMILY_KEY = "bord:font-family";
const DEFAULT_FONT_FAMILY = '"MesloLGS NF", "MesloLGM Nerd Font", "JetBrainsMono Nerd Font", "Hack Nerd Font", Menlo, monospace';

export const FONT_PRESETS = [
  { label: "Default (Nerd Font chain)", value: DEFAULT_FONT_FAMILY },
  { label: "MesloLGS NF", value: '"MesloLGS NF", monospace' },
  { label: "JetBrainsMono Nerd Font", value: '"JetBrainsMono Nerd Font", monospace' },
  { label: "Hack Nerd Font", value: '"Hack Nerd Font", monospace' },
  { label: "FiraCode Nerd Font", value: '"FiraCode Nerd Font", monospace' },
  { label: "Menlo", value: "Menlo, monospace" },
  { label: "Monaco", value: "Monaco, monospace" },
  { label: "monospace", value: "monospace" },
] as const;

function loadFontFamily(): string {
  try {
    const stored = localStorage.getItem(FONT_FAMILY_KEY);
    if (stored) return stored;
  } catch {}
  return DEFAULT_FONT_FAMILY;
}

const [fontFamily, setFontFamilyRaw] = createSignal(loadFontFamily());

export function setFontFamily(family: string) {
  setFontFamilyRaw(family);
  localStorage.setItem(FONT_FAMILY_KEY, family);
}

export { fontFamily };

// File icon pack
const FILE_ICON_PACK_KEY = "bord:file-icon-pack";
const FILE_ICON_PACK_EXPLICIT_KEY = "bord:file-icon-pack-explicit";
const DEFAULT_FILE_ICON_PACK: FileIconPackId = "catppuccin";

function isFileIconPackId(value: string | null): value is FileIconPackId {
  return value === "classic" || value === "catppuccin" || value === "material" || value === "vscode";
}

function loadFileIconPack(): FileIconPackId {
  try {
    const stored = localStorage.getItem(FILE_ICON_PACK_KEY);
    const explicit = localStorage.getItem(FILE_ICON_PACK_EXPLICIT_KEY) === "1";

    if (isFileIconPackId(stored)) {
      // Migrate old implicit default from "classic" to the newer VS Code-like pack.
      if (stored === "classic" && !explicit) return "catppuccin";
      return stored;
    }
  } catch {}
  return DEFAULT_FILE_ICON_PACK;
}

const [fileIconPack, setFileIconPackRaw] = createSignal<FileIconPackId>(loadFileIconPack());

export function setFileIconPack(pack: FileIconPackId) {
  setFileIconPackRaw(pack);
  localStorage.setItem(FILE_ICON_PACK_KEY, pack);
  localStorage.setItem(FILE_ICON_PACK_EXPLICIT_KEY, "1");
}

export { fileIconPack };

// Global settings panel open state (so Cmd+, can open it from anywhere)
const [settingsOpen, setSettingsOpen] = createSignal(false);
export { settingsOpen, setSettingsOpen };
