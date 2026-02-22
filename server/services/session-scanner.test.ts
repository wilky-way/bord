import { describe, expect, test } from "bun:test";
import {
  isProvider,
  normalizeSessionTitle,
  normalizeSessionTime,
  decodeDirToPath,
} from "./session-scanner";

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

  test("returns fallback for non-string types", () => {
    expect(normalizeSessionTime(12345, "fb")).toBe("fb");
    expect(normalizeSessionTime(true, "fb")).toBe("fb");
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
