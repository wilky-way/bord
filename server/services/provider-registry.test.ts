import { describe, test, expect, beforeEach } from "bun:test";
import type { SessionInfo } from "./session-scanner";

/**
 * Provider registry tests.
 *
 * The registry is module-level state (a Map). We re-import the module fresh
 * is not trivial, so we test the public API sequentially, aware that state
 * persists across tests within this file. We use unique IDs per test to
 * avoid collisions.
 */
import {
  registerServerProvider,
  getServerProvider,
  listServerProviders,
  scanSessionsFromRegistry,
} from "./provider-registry";

// Note: session-scanner.ts registers providers on import.
// Those may already be in the registry. We test with unique IDs.

describe("provider-registry", () => {
  test("register adds provider to registry", () => {
    const scanner = async () => [] as SessionInfo[];
    registerServerProvider({ id: "test-register", scanSessions: scanner });
    const provider = getServerProvider("test-register");
    expect(provider).toBeDefined();
    expect(provider!.id).toBe("test-register");
  });

  test("get returns registered provider", () => {
    const scanner = async () => [] as SessionInfo[];
    registerServerProvider({ id: "test-get", scanSessions: scanner });
    const provider = getServerProvider("test-get");
    expect(provider).not.toBeUndefined();
    expect(provider!.id).toBe("test-get");
  });

  test("get returns undefined for unknown ID", () => {
    const provider = getServerProvider("nonexistent-provider-xyz");
    expect(provider).toBeUndefined();
  });

  test("list returns all registered providers", () => {
    const list = listServerProviders();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  test("register overwrites existing provider", () => {
    const scanner1 = async () => [{ id: "s1" }] as SessionInfo[];
    const scanner2 = async () => [{ id: "s2" }] as SessionInfo[];
    registerServerProvider({ id: "test-overwrite", scanSessions: scanner1 });
    registerServerProvider({ id: "test-overwrite", scanSessions: scanner2 });
    const provider = getServerProvider("test-overwrite");
    // The second registration should have replaced the first
    expect(provider).toBeDefined();
  });

  test("scan invokes scanner and returns results", async () => {
    const sessions: SessionInfo[] = [
      {
        id: "sess-1",
        title: "Test session",
        projectPath: "/test",
        startedAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T01:00:00Z",
        messageCount: 5,
        provider: "claude",
      },
    ];
    registerServerProvider({ id: "test-scan", scanSessions: async () => sessions });
    const result = await scanSessionsFromRegistry(undefined, "test-scan");
    expect(result).toEqual(sessions);
  });

  test("scan returns empty for unknown provider", async () => {
    const result = await scanSessionsFromRegistry(undefined, "nonexistent-scan-xyz");
    expect(result).toEqual([]);
  });

  test("registered providers have correct shape", () => {
    registerServerProvider({
      id: "test-shape",
      scanSessions: async () => [],
    });
    const provider = getServerProvider("test-shape");
    expect(provider).toHaveProperty("id");
    expect(provider).toHaveProperty("scanSessions");
    expect(typeof provider!.scanSessions).toBe("function");
  });
});
