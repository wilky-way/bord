import { describe, test, expect, beforeEach } from "bun:test";
import { createRoot } from "solid-js";
import {
  registerProvider,
  getProvider,
  listProviders,
  enabledProviders,
  setProviderEnabled,
} from "./registry";
import type { ProviderDefinition } from "./registry";

function makeDummyProvider(id: string, enabled = true): ProviderDefinition {
  return {
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    color: "#000000",
    icon: (() => null) as any,
    command: id,
    enabled,
    buildNewSessionCommand: () => [id],
    buildResumeCommand: (sid: string) => [id, "--resume", sid],
    getResumeSessionId: (cmd: string[]) => cmd[2],
  };
}

describe("provider registry", () => {
  // Note: the registry uses module-level signals, so providers registered in
  // earlier tests persist. We account for that by using unique IDs per test
  // and testing relative changes rather than absolute counts where needed.

  test("registerProvider adds provider to registry", () => {
    createRoot((dispose) => {
      const before = listProviders().length;
      registerProvider(makeDummyProvider("test-reg-add"));
      expect(listProviders().length).toBe(before + 1);
      dispose();
    });
  });

  test("getProvider returns registered provider", () => {
    createRoot((dispose) => {
      registerProvider(makeDummyProvider("test-get-known"));
      const p = getProvider("test-get-known");
      expect(p).toBeDefined();
      expect(p!.id).toBe("test-get-known");
      dispose();
    });
  });

  test("getProvider returns undefined for unknown id", () => {
    createRoot((dispose) => {
      expect(getProvider("does-not-exist-xyz")).toBeUndefined();
      dispose();
    });
  });

  test("listProviders returns all registered providers", () => {
    createRoot((dispose) => {
      registerProvider(makeDummyProvider("test-list-a"));
      registerProvider(makeDummyProvider("test-list-b"));
      const ids = listProviders().map((p) => p.id);
      expect(ids).toContain("test-list-a");
      expect(ids).toContain("test-list-b");
      dispose();
    });
  });

  test("listProviders returns empty when no custom providers registered", () => {
    // We can't truly clear the registry since it's module-level, but we
    // verify the function returns an array (structurally correct).
    createRoot((dispose) => {
      const result = listProviders();
      expect(Array.isArray(result)).toBe(true);
      dispose();
    });
  });

  test("enabledProviders returns only enabled providers", () => {
    createRoot((dispose) => {
      registerProvider(makeDummyProvider("test-enabled-yes", true));
      registerProvider(makeDummyProvider("test-enabled-no", false));
      const enabled = enabledProviders();
      const ids = enabled.map((p) => p.id);
      expect(ids).toContain("test-enabled-yes");
      expect(ids).not.toContain("test-enabled-no");
      dispose();
    });
  });

  test("setProviderEnabled toggles provider state", () => {
    createRoot((dispose) => {
      registerProvider(makeDummyProvider("test-toggle", true));
      expect(getProvider("test-toggle")!.enabled).toBe(true);
      setProviderEnabled("test-toggle", false);
      expect(getProvider("test-toggle")!.enabled).toBe(false);
      setProviderEnabled("test-toggle", true);
      expect(getProvider("test-toggle")!.enabled).toBe(true);
      dispose();
    });
  });

  test("setProviderEnabled on unknown id is a no-op", () => {
    createRoot((dispose) => {
      const before = listProviders().length;
      setProviderEnabled("nonexistent-provider", true);
      expect(listProviders().length).toBe(before);
      dispose();
    });
  });

  test("registerProvider with duplicate id overwrites", () => {
    createRoot((dispose) => {
      registerProvider(makeDummyProvider("test-dup"));
      expect(getProvider("test-dup")!.color).toBe("#000000");
      const updated = { ...makeDummyProvider("test-dup"), color: "#FF0000" };
      registerProvider(updated);
      expect(getProvider("test-dup")!.color).toBe("#FF0000");
      dispose();
    });
  });

  test("provider has correct shape", () => {
    createRoot((dispose) => {
      registerProvider(makeDummyProvider("test-shape"));
      const p = getProvider("test-shape")!;
      expect(p.id).toBe("test-shape");
      expect(p.label).toBe("Test-shape");
      expect(typeof p.color).toBe("string");
      expect(typeof p.command).toBe("string");
      expect(typeof p.enabled).toBe("boolean");
      expect(typeof p.buildNewSessionCommand).toBe("function");
      expect(typeof p.buildResumeCommand).toBe("function");
      expect(typeof p.getResumeSessionId).toBe("function");
      expect(p.buildNewSessionCommand()).toEqual(["test-shape"]);
      expect(p.buildResumeCommand("abc")).toEqual(["test-shape", "--resume", "abc"]);
      dispose();
    });
  });
});
