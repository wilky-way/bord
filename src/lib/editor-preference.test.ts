import { describe, test, expect, beforeEach } from "bun:test";
import { createRoot } from "solid-js";
import { getPreferredEditor, setPreferredEditor } from "./editor-preference";

const storage = (globalThis as any).__testStorage as Map<string, string>;

describe("editor-preference", () => {
  beforeEach(() => {
    storage.clear();
  });

  test("default value is cursor", () => {
    createRoot((dispose) => {
      expect(getPreferredEditor()).toBe("cursor");
      dispose();
    });
  });

  test("set/get roundtrip", () => {
    createRoot((dispose) => {
      setPreferredEditor("vscode");
      expect(getPreferredEditor()).toBe("vscode");

      setPreferredEditor("zed");
      expect(getPreferredEditor()).toBe("zed");
      dispose();
    });
  });

  test("persists to localStorage", () => {
    createRoot((dispose) => {
      setPreferredEditor("vscode");
      expect(storage.get("bord-preferred-editor")).toBe("vscode");

      setPreferredEditor("zed");
      expect(storage.get("bord-preferred-editor")).toBe("zed");
      dispose();
    });
  });
});
