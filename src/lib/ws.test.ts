import { describe, expect, test } from "bun:test";
import { drainBufferedOutputSlice, parseOscTurnState, shouldKeepBackgroundConnection } from "./ws";

describe("parseOscTurnState", () => {
  test("classifies Claude spinner titles as working", () => {
    expect(parseOscTurnState("claude", "⠋ Claude Code")).toBe("working");
  });

  test("classifies non-spinner Claude titles as done", () => {
    expect(parseOscTurnState("claude", "Claude Code")).toBe("done");
  });

  test("classifies Gemini symbols", () => {
    expect(parseOscTurnState("gemini", "✦ Working")).toBe("working");
    expect(parseOscTurnState("gemini", "◇ Ready")).toBe("done");
  });

  test("classifies Codex and OpenCode active keywords", () => {
    expect(parseOscTurnState("codex", "Thinking about tests")).toBe("working");
    expect(parseOscTurnState("opencode", "running commands")).toBe("working");
  });

  test("classifies Codex/OpenCode done keywords", () => {
    expect(parseOscTurnState("codex", "ready for input")).toBe("done");
    expect(parseOscTurnState("opencode", "awaiting input")).toBe("done");
  });

  test("keeps unknown titles unknown for Codex/OpenCode", () => {
    expect(parseOscTurnState("codex", "Codex")).toBe("unknown");
    expect(parseOscTurnState("opencode", "OpenCode")).toBe("unknown");
  });
});

describe("shouldKeepBackgroundConnection", () => {
  test("returns false without a provider terminal", () => {
    expect(shouldKeepBackgroundConnection(undefined, "working")).toBe(false);
    expect(
      shouldKeepBackgroundConnection(
        {
          provider: undefined,
          notificationsArmed: false,
          notificationWarmupStartedAt: undefined,
        },
        "working",
      ),
    ).toBe(false);
  });

  test("returns true when turn state is working", () => {
    expect(
      shouldKeepBackgroundConnection(
        {
          provider: "opencode",
          notificationsArmed: false,
          notificationWarmupStartedAt: undefined,
        },
        "working",
      ),
    ).toBe(true);
  });

  test("returns true when terminal is armed", () => {
    expect(
      shouldKeepBackgroundConnection(
        {
          provider: "codex",
          notificationsArmed: true,
          notificationWarmupStartedAt: undefined,
        },
        "unknown",
      ),
    ).toBe(true);
  });

  test("returns true during warmup", () => {
    expect(
      shouldKeepBackgroundConnection(
        {
          provider: "claude",
          notificationsArmed: false,
          notificationWarmupStartedAt: Date.now(),
        },
        "unknown",
      ),
    ).toBe(true);
  });

  test("returns false for idle unknown state", () => {
    expect(
      shouldKeepBackgroundConnection(
        {
          provider: "gemini",
          notificationsArmed: false,
          notificationWarmupStartedAt: undefined,
        },
        "unknown",
      ),
    ).toBe(false);
  });
});

describe("drainBufferedOutputSlice", () => {
  test("respects chunk budget", () => {
    const queue = ["a", "b", "c", "d", "e"];
    const result = drainBufferedOutputSlice(queue, 1024, 2);

    expect(result.chunks).toEqual(["a", "b"]);
    expect(queue).toEqual(["c", "d", "e"]);
  });

  test("drains at least one chunk when byte budget is tiny", () => {
    const queue = ["long chunk", "next"];
    const result = drainBufferedOutputSlice(queue, 1, 10);

    expect(result.chunks.length).toBe(1);
    expect(queue).toEqual(["next"]);
  });

  test("honors byte budget across multiple chunks", () => {
    const queue = ["12345", "67890", "abcde", "fghij"];
    const result = drainBufferedOutputSlice(queue, 12, 10);

    expect(result.chunks).toEqual(["12345", "67890", "abcde"]);
    expect(result.bytes).toBeGreaterThanOrEqual(12);
    expect(queue).toEqual(["fghij"]);
  });
});
