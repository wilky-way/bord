import { describe, expect, test, afterAll } from "bun:test";
import {
  isProvider,
  normalizeSessionTitle,
  normalizeSessionTime,
  decodeDirToPath,
  _readSessionIndex as readSessionIndex,
} from "./session-scanner";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("isProvider", () => {
  test("accepts all valid providers", () => {
    expect(isProvider("claude")).toBe(true);
    expect(isProvider("codex")).toBe(true);
    expect(isProvider("opencode")).toBe(true);
    expect(isProvider("gemini")).toBe(true);
  });

  test("rejects case-sensitive variants", () => {
    expect(isProvider("Claude")).toBe(false);
    expect(isProvider("CODEX")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(isProvider("")).toBe(false);
  });

  test("rejects unknown providers", () => {
    expect(isProvider("chatgpt")).toBe(false);
    expect(isProvider("copilot")).toBe(false);
  });
});

describe("normalizeSessionTitle", () => {
  test("collapses whitespace", () => {
    expect(normalizeSessionTitle("hello   world")).toBe("hello world");
    expect(normalizeSessionTitle("  hello  \t world  ")).toBe("hello world");
  });

  test("returns 'Untitled Session' for empty input", () => {
    expect(normalizeSessionTitle("")).toBe("Untitled Session");
    expect(normalizeSessionTitle("   ")).toBe("Untitled Session");
    expect(normalizeSessionTitle("\t\n")).toBe("Untitled Session");
  });

  test("truncates at maxLength", () => {
    const long = "a".repeat(100);
    expect(normalizeSessionTitle(long, 80)).toHaveLength(80);
    expect(normalizeSessionTitle(long, 10)).toHaveLength(10);
  });

  test("uses default maxLength of 80", () => {
    const long = "a".repeat(100);
    expect(normalizeSessionTitle(long)).toHaveLength(80);
  });

  test("preserves short titles unchanged", () => {
    expect(normalizeSessionTitle("Fix the auth bug")).toBe("Fix the auth bug");
  });
});

describe("normalizeSessionTime", () => {
  test("returns ISO string for valid dates", () => {
    const result = normalizeSessionTime("2024-06-15T10:30:00Z", "fallback");
    expect(result).toBe("2024-06-15T10:30:00.000Z");
  });

  test("handles epoch milliseconds", () => {
    const result = normalizeSessionTime(1772139248299, "fallback");
    expect(result).toBe("2026-02-26T20:54:08.299Z");
  });

  test("handles epoch numeric strings", () => {
    const result = normalizeSessionTime("1772139248299", "fallback");
    expect(result).toBe("2026-02-26T20:54:08.299Z");
  });

  test("handles ISO date strings without time", () => {
    const result = normalizeSessionTime("2024-01-01", "fallback");
    expect(result).toMatch(/^2024-01-01/);
  });

  test("returns fallback for empty string", () => {
    expect(normalizeSessionTime("", "fallback-val")).toBe("fallback-val");
  });

  test("returns fallback for null", () => {
    expect(normalizeSessionTime(null, "fb")).toBe("fb");
  });

  test("returns fallback for undefined", () => {
    expect(normalizeSessionTime(undefined, "fb")).toBe("fb");
  });

  test("returns fallback for unsupported non-string types", () => {
    expect(normalizeSessionTime(true, "fb")).toBe("fb");
    expect(normalizeSessionTime({} as any, "fb")).toBe("fb");
  });

  test("returns fallback for invalid date strings", () => {
    expect(normalizeSessionTime("not-a-date", "fb")).toBe("fb");
    expect(normalizeSessionTime("yesterday", "fb")).toBe("fb");
  });

  test("returns fallback for whitespace-only string", () => {
    expect(normalizeSessionTime("   ", "fb")).toBe("fb");
  });
});

describe("decodeDirToPath", () => {
  test("converts dashes to slashes", () => {
    expect(decodeDirToPath("-Users-alice-projects-myapp")).toBe("/Users/alice/projects/myapp");
  });

  test("collapses double slashes", () => {
    // Leading dash produces //, which should be collapsed
    const result = decodeDirToPath("-Users-alice");
    expect(result).toBe("/Users/alice");
    expect(result).not.toContain("//");
  });

  test("handles deep paths", () => {
    expect(decodeDirToPath("-home-user-dev-project-src-lib")).toBe("/home/user/dev/project/src/lib");
  });

  test("handles single segment", () => {
    expect(decodeDirToPath("-tmp")).toBe("/tmp");
  });
});

describe("readSessionIndex", () => {
  const testDir = join(tmpdir(), "bord-test-session-index-" + Date.now());

  function writeIndex(name: string, data: unknown) {
    const dir = join(testDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "sessions-index.json"), JSON.stringify(data));
  }

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("parses { version, entries: [...] } envelope format", async () => {
    writeIndex("envelope", {
      version: 1,
      entries: [
        { sessionId: "s1", summary: "Fix bug" },
        { sessionId: "s2", summary: "Add feature" },
      ],
    });
    const map = await readSessionIndex(join(testDir, "envelope"));
    expect(map.size).toBe(2);
    expect(map.get("s1")?.summary).toBe("Fix bug");
    expect(map.get("s2")?.summary).toBe("Add feature");
  });

  test("parses flat array format", async () => {
    writeIndex("flat-array", [
      { sessionId: "a1", summary: "Session A" },
      { sessionId: "a2", summary: "Session B" },
    ]);
    const map = await readSessionIndex(join(testDir, "flat-array"));
    expect(map.size).toBe(2);
    expect(map.get("a1")?.summary).toBe("Session A");
  });

  test("parses object keyed by session id", async () => {
    writeIndex("obj-keyed", {
      "obj-1": { summary: "Obj Session 1", messageCount: 5 },
      "obj-2": { summary: "Obj Session 2", messageCount: 10 },
    });
    const map = await readSessionIndex(join(testDir, "obj-keyed"));
    expect(map.size).toBe(2);
    expect(map.get("obj-1")?.summary).toBe("Obj Session 1");
    expect(map.get("obj-1")?.messageCount).toBe(5);
  });

  test("returns empty map for nonexistent directory", async () => {
    const map = await readSessionIndex(join(testDir, "nonexistent"));
    expect(map.size).toBe(0);
  });

  test("returns empty map for invalid JSON", async () => {
    const dir = join(testDir, "bad-json");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "sessions-index.json"), "not valid json{{{");
    const map = await readSessionIndex(dir);
    expect(map.size).toBe(0);
  });

  test("skips entries without sessionId", async () => {
    writeIndex("missing-id", [
      { sessionId: "valid", summary: "OK" },
      { summary: "No ID" } as any,
    ]);
    const map = await readSessionIndex(join(testDir, "missing-id"));
    expect(map.size).toBe(1);
    expect(map.has("valid")).toBe(true);
  });
});
