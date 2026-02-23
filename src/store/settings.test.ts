import { describe, test, expect, beforeEach } from "bun:test";
import { createRoot } from "solid-js";
import {
  fontSize,
  increaseFontSize,
  decreaseFontSize,
  resetFontSize,
  fontFamily,
  setFontFamily,
} from "./settings";

const storage = (globalThis as any).__testStorage as Map<string, string>;

describe("settings - fontSize", () => {
  beforeEach(() => {
    storage.clear();
    // Reset to default via the exported function
    resetFontSize();
  });

  test("default value is 13", () => {
    createRoot((dispose) => {
      expect(fontSize()).toBe(13);
      dispose();
    });
  });

  test("increaseFontSize increments by 1", () => {
    createRoot((dispose) => {
      resetFontSize(); // 13
      increaseFontSize();
      expect(fontSize()).toBe(14);
      dispose();
    });
  });

  test("decreaseFontSize decrements by 1", () => {
    createRoot((dispose) => {
      resetFontSize(); // 13
      decreaseFontSize();
      expect(fontSize()).toBe(12);
      dispose();
    });
  });

  test("resetFontSize returns to 13", () => {
    createRoot((dispose) => {
      increaseFontSize();
      increaseFontSize();
      resetFontSize();
      expect(fontSize()).toBe(13);
      dispose();
    });
  });

  test("clamps at minimum 8", () => {
    createRoot((dispose) => {
      // Go well below 8
      for (let i = 0; i < 20; i++) decreaseFontSize();
      expect(fontSize()).toBe(8);
      dispose();
    });
  });

  test("clamps at maximum 24", () => {
    createRoot((dispose) => {
      // Go well above 24
      for (let i = 0; i < 20; i++) increaseFontSize();
      expect(fontSize()).toBe(24);
      dispose();
    });
  });

  test("persists to localStorage", () => {
    createRoot((dispose) => {
      resetFontSize();
      increaseFontSize(); // 14
      expect(storage.get("bord:font-size")).toBe("14");
      dispose();
    });
  });
});

describe("settings - fontFamily", () => {
  beforeEach(() => {
    storage.clear();
  });

  test("setFontFamily updates signal", () => {
    createRoot((dispose) => {
      setFontFamily("Monaco, monospace");
      expect(fontFamily()).toBe("Monaco, monospace");
      dispose();
    });
  });

  test("setFontFamily persists to localStorage", () => {
    createRoot((dispose) => {
      setFontFamily("Menlo, monospace");
      expect(storage.get("bord:font-family")).toBe("Menlo, monospace");
      dispose();
    });
  });
});
