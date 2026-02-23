import { describe, test, expect, beforeEach } from "bun:test";
import { createRoot } from "solid-js";
import { setTheme, activeTheme, applyTheme } from "./theme";
import { getTheme, getDefaultTheme, themes } from "./themes";

const storage = (globalThis as any).__testStorage as Map<string, string>;
const styleProps = (globalThis as any).__testStyleProps as Map<string, string>;

describe("theme manager", () => {
  beforeEach(() => {
    storage.clear();
    styleProps.clear();
  });

  test("setTheme persists to localStorage", () => {
    createRoot((dispose) => {
      setTheme("dracula");
      expect(storage.get("bord-theme")).toBe("dracula");
      dispose();
    });
  });

  test("setTheme applies CSS variables via applyTheme", () => {
    createRoot((dispose) => {
      setTheme("dracula");
      const dracula = getTheme("dracula");
      expect(styleProps.get("--bg-primary")).toBe(dracula.chrome.bgPrimary);
      expect(styleProps.get("--accent")).toBe(dracula.chrome.accent);
      expect(styleProps.get("--text-primary")).toBe(dracula.chrome.textPrimary);
      dispose();
    });
  });

  test("applyTheme sets all chrome CSS variables", () => {
    const tokyo = getTheme("tokyo-night");
    applyTheme(tokyo);
    expect(styleProps.get("--bg-primary")).toBe(tokyo.chrome.bgPrimary);
    expect(styleProps.get("--bg-secondary")).toBe(tokyo.chrome.bgSecondary);
    expect(styleProps.get("--bg-tertiary")).toBe(tokyo.chrome.bgTertiary);
    expect(styleProps.get("--border")).toBe(tokyo.chrome.border);
    expect(styleProps.get("--text-primary")).toBe(tokyo.chrome.textPrimary);
    expect(styleProps.get("--text-secondary")).toBe(tokyo.chrome.textSecondary);
    expect(styleProps.get("--accent")).toBe(tokyo.chrome.accent);
    expect(styleProps.get("--accent-hover")).toBe(tokyo.chrome.accentHover);
    expect(styleProps.get("--danger")).toBe(tokyo.chrome.danger);
    expect(styleProps.get("--success")).toBe(tokyo.chrome.success);
    expect(styleProps.get("--warning")).toBe(tokyo.chrome.warning);
    expect(styleProps.get("--diff-add-bg")).toBe(tokyo.chrome.diffAddBg);
    expect(styleProps.get("--diff-delete-bg")).toBe(tokyo.chrome.diffDeleteBg);
  });

  test("getTheme returns the correct theme by ID", () => {
    const nord = getTheme("nord");
    expect(nord.id).toBe("nord");
    expect(nord.name).toBe("Nord");
  });

  test("unknown theme ID falls back to default", () => {
    const theme = getTheme("nonexistent-theme");
    const defaultTheme = getDefaultTheme();
    expect(theme.id).toBe(defaultTheme.id);
  });

  test("getDefaultTheme returns catppuccin-frappe", () => {
    const def = getDefaultTheme();
    expect(def.id).toBe("catppuccin-frappe");
  });

  test("activeTheme returns a valid theme on initial load", () => {
    createRoot((dispose) => {
      const theme = activeTheme();
      // Should be a valid theme (either stored or default)
      expect(themes.some((t) => t.id === theme.id)).toBe(true);
      dispose();
    });
  });
});
