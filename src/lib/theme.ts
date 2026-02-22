import { createSignal, createMemo } from "solid-js";
import { getTheme, getDefaultTheme } from "./themes";
import type { BordTheme } from "./themes";

const STORAGE_KEY = "bord-theme";

const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
const [themeId, _setThemeId] = createSignal(stored ?? getDefaultTheme().id);

export const activeTheme = createMemo<BordTheme>(() => getTheme(themeId()));
export const terminalTheme = createMemo(() => activeTheme().terminal);

export function setTheme(id: string) {
  _setThemeId(id);
  localStorage.setItem(STORAGE_KEY, id);
  applyTheme(getTheme(id));
}

export function applyTheme(theme: BordTheme) {
  const root = document.documentElement.style;
  const c = theme.chrome;
  root.setProperty("--bg-primary", c.bgPrimary);
  root.setProperty("--bg-secondary", c.bgSecondary);
  root.setProperty("--bg-tertiary", c.bgTertiary);
  root.setProperty("--border", c.border);
  root.setProperty("--text-primary", c.textPrimary);
  root.setProperty("--text-secondary", c.textSecondary);
  root.setProperty("--accent", c.accent);
  root.setProperty("--accent-hover", c.accentHover);
  root.setProperty("--danger", c.danger);
  root.setProperty("--success", c.success);
  root.setProperty("--warning", c.warning);
  root.setProperty("--diff-add-bg", c.diffAddBg);
  root.setProperty("--diff-delete-bg", c.diffDeleteBg);
}

// Apply on module load so the saved theme is hydrated immediately
applyTheme(getTheme(themeId()));
