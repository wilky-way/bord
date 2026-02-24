import { describe, test, expect, beforeEach } from "bun:test";
import { createRoot } from "solid-js";
import { getPreferredEditor, setPreferredEditor, getFileOpenTarget, setFileOpenTarget } from "./editor-preference";

const storage = (globalThis as any).__testStorage as Map<string, string>;

describe("editor-preference", () => {
  beforeEach(() => {
    storage.clear();
    setPreferredEditor("cursor");
    setFileOpenTarget("terminal");
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

  test("default file open target is terminal", () => {
    createRoot((dispose) => {
      expect(getFileOpenTarget()).toBe("terminal");
      dispose();
    });
  });

  test("file open target set/get roundtrip", () => {
    createRoot((dispose) => {
      setFileOpenTarget("editor");
      expect(getFileOpenTarget()).toBe("editor");

      setFileOpenTarget("terminal");
      expect(getFileOpenTarget()).toBe("terminal");
      dispose();
    });
  });

  test("file open target persists to localStorage", () => {
    createRoot((dispose) => {
      setFileOpenTarget("editor");
      expect(storage.get("bord-file-open-target")).toBe("editor");

      setFileOpenTarget("terminal");
      expect(storage.get("bord-file-open-target")).toBe("terminal");
      dispose();
    });
  });
});
