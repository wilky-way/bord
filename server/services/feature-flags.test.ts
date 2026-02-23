import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";

let testDb: Database;

mock.module("./db", () => ({
  getDb: () => testDb,
  initDb: () => testDb,
}));

const { getFeatureFlags, updateFeatureFlags, isFeatureEnabled, isProviderEnabled } = await import("./feature-flags");

beforeEach(() => {
  testDb = new Database(":memory:");
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
});

describe("getFeatureFlags", () => {
  test("returns defaults when no stored flags", () => {
    const flags = getFeatureFlags();
    expect(flags.git).toBe(true);
    expect(flags.docker).toBe(true);
    expect(flags.sessions).toBe(true);
    expect(flags.providers.claude).toBe(true);
    expect(flags.providers.codex).toBe(true);
    expect(flags.providers.opencode).toBe(true);
    expect(flags.providers.gemini).toBe(true);
  });

  test("returns stored flags", () => {
    testDb.run(
      "INSERT INTO app_state (key, value) VALUES ('feature_flags', ?)",
      [JSON.stringify({ git: false, docker: true, sessions: false, providers: { claude: false } })],
    );
    const flags = getFeatureFlags();
    expect(flags.git).toBe(false);
    expect(flags.docker).toBe(true);
    expect(flags.sessions).toBe(false);
    expect(flags.providers.claude).toBe(false);
    // Defaults still present for other providers
    expect(flags.providers.codex).toBe(true);
  });

  test("handles malformed JSON gracefully", () => {
    testDb.run(
      "INSERT INTO app_state (key, value) VALUES ('feature_flags', ?)",
      ["not valid json{{{"],
    );
    const flags = getFeatureFlags();
    // Should return defaults
    expect(flags.git).toBe(true);
    expect(flags.docker).toBe(true);
  });

  test("handles missing fields with defaults", () => {
    testDb.run(
      "INSERT INTO app_state (key, value) VALUES ('feature_flags', ?)",
      [JSON.stringify({ git: false })],
    );
    const flags = getFeatureFlags();
    expect(flags.git).toBe(false);
    expect(flags.docker).toBe(true); // default
    expect(flags.sessions).toBe(true); // default
    expect(flags.providers.claude).toBe(true); // default
  });
});

describe("updateFeatureFlags", () => {
  test("merges partial updates", () => {
    const result = updateFeatureFlags({ git: false });
    expect(result.git).toBe(false);
    expect(result.docker).toBe(true);
    expect(result.sessions).toBe(true);
  });

  test("persists to database", () => {
    updateFeatureFlags({ docker: false });
    // Read back from DB directly
    const row = testDb.query<{ value: string }, []>("SELECT value FROM app_state WHERE key = 'feature_flags'").get();
    expect(row).not.toBeNull();
    const parsed = JSON.parse(row!.value);
    expect(parsed.docker).toBe(false);
  });

  test("preserves existing providers", () => {
    updateFeatureFlags({ providers: { claude: false } });
    const flags = getFeatureFlags();
    expect(flags.providers.claude).toBe(false);
    expect(flags.providers.codex).toBe(true);
    expect(flags.providers.opencode).toBe(true);
    expect(flags.providers.gemini).toBe(true);
  });

  test("adds new providers", () => {
    updateFeatureFlags({ providers: { custom: true } as any });
    const flags = getFeatureFlags();
    expect((flags.providers as any).custom).toBe(true);
    // Existing defaults still present
    expect(flags.providers.claude).toBe(true);
  });
});

describe("isFeatureEnabled", () => {
  test("returns true for enabled feature", () => {
    expect(isFeatureEnabled("git")).toBe(true);
  });

  test("returns false for disabled feature", () => {
    updateFeatureFlags({ git: false });
    expect(isFeatureEnabled("git")).toBe(false);
  });
});

describe("isProviderEnabled", () => {
  test("returns true for enabled provider", () => {
    expect(isProviderEnabled("claude")).toBe(true);
  });

  test("returns false for disabled provider", () => {
    updateFeatureFlags({ providers: { claude: false } });
    expect(isProviderEnabled("claude")).toBe(false);
  });
});
