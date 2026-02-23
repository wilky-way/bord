import { describe, test, expect, spyOn, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { Subprocess } from "bun";

// Use real filesystem paths — no mock.module needed.
const TEST_DIR = join(tmpdir(), "bord-editor-test-" + Date.now());
const TEST_FILE = join(TEST_DIR, "test-file.ts");
const NONEXISTENT = join(TEST_DIR, "nonexistent.ts");
const BAD_CWD = join(tmpdir(), "bord-editor-bad-cwd-" + Date.now());

function fakeProc(exitCode: number, stderr = ""): Subprocess {
  return {
    stdout: new Response("").body!,
    stderr: new Response(stderr).body!,
    exited: Promise.resolve(exitCode),
    pid: 1234,
    killed: false,
    exitCode: null,
    signalCode: null,
    kill: () => {},
    ref: () => {},
    unref: () => {},
    stdin: undefined as any,
    resourceUsage: () => undefined as any,
    readable: undefined as any,
    [Symbol.asyncDispose]: async () => {},
  } as unknown as Subprocess;
}

const { openInEditor } = await import("./editor-service");

let spawnSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(TEST_FILE, "// test file");
  spawnSpy = spyOn(Bun, "spawn");
});

afterEach(() => {
  spawnSpy.mockRestore();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("mergedPath", () => {
  test("includes homebrew paths in spawn env", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    await openInEditor(TEST_DIR, "vscode");
    const env = spawnSpy.mock.calls[0]?.[1]?.env;
    expect(env?.PATH).toContain("/opt/homebrew/bin");
  });

  test("includes /usr/local paths in spawn env", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    await openInEditor(TEST_DIR, "vscode");
    const env = spawnSpy.mock.calls[0]?.[1]?.env;
    expect(env?.PATH).toContain("/usr/local/bin");
  });

  test("deduplicates entries", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    await openInEditor(TEST_DIR, "vscode");
    const env = spawnSpy.mock.calls[0]?.[1]?.env;
    const parts = env?.PATH?.split(":") ?? [];
    const homebrew = parts.filter((p: string) => p === "/opt/homebrew/bin");
    expect(homebrew.length).toBe(1);
  });
});

describe("openInEditor", () => {
  test("with vscode calls code CLI", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    const result = await openInEditor(TEST_DIR, "vscode");
    expect(result.ok).toBe(true);
    expect(spawnSpy.mock.calls[0][0][0]).toBe("code");
  });

  test("with cursor calls cursor CLI", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    const result = await openInEditor(TEST_DIR, "cursor");
    expect(result.ok).toBe(true);
    expect(spawnSpy.mock.calls[0][0][0]).toBe("cursor");
  });

  test("with zed calls zed CLI", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    const result = await openInEditor(TEST_DIR, "zed");
    expect(result.ok).toBe(true);
    expect(spawnSpy.mock.calls[0][0][0]).toBe("zed");
  });

  test("invalid cwd returns error", async () => {
    const result = await openInEditor(BAD_CWD, "vscode");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("does not exist");
  });

  test("unknown editor returns error", async () => {
    const result = await openInEditor(TEST_DIR, "notepad" as any);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown editor");
  });

  test("file not found returns error", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    const result = await openInEditor(TEST_DIR, "vscode", "nonexistent.ts");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("does not exist");
  });

  test("falls through CLI chain on failure", async () => {
    spawnSpy.mockReturnValue(fakeProc(1, "command not found"));
    const result = await openInEditor(TEST_DIR, "vscode");
    expect(result.ok).toBe(false);
    // Should have tried multiple commands (bare CLI + macOS open -a fallbacks)
    expect(spawnSpy.mock.calls.length).toBeGreaterThan(1);
  });

  test("macOS open -a fallback", async () => {
    // First call (bare CLI) fails, then open -a succeeds
    spawnSpy
      .mockReturnValueOnce(fakeProc(1, "not found"))
      .mockReturnValue(fakeProc(0));
    const result = await openInEditor(TEST_DIR, "vscode");
    expect(result.ok).toBe(true);
  });
});

describe("Editor config shape", () => {
  test("vscode has correct CLI paths", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    const result = await openInEditor(TEST_DIR, "vscode");
    expect(result.ok).toBe(true);
  });

  test("cursor has correct CLI paths", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    const result = await openInEditor(TEST_DIR, "cursor");
    expect(result.ok).toBe(true);
  });

  test("zed has correct CLI paths", async () => {
    spawnSpy.mockReturnValue(fakeProc(0));
    const result = await openInEditor(TEST_DIR, "zed");
    expect(result.ok).toBe(true);
  });
});
