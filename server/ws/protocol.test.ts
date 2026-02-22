import { describe, expect, test } from "bun:test";
import { isControlMessage } from "./protocol";

describe("isControlMessage", () => {
  test("accepts valid resize message", () => {
    expect(isControlMessage({ type: "resize", cols: 80, rows: 24 })).toBe(true);
  });

  test("accepts valid ping message", () => {
    expect(isControlMessage({ type: "ping" })).toBe(true);
  });

  test("accepts valid pong message", () => {
    expect(isControlMessage({ type: "pong" })).toBe(true);
  });

  test("accepts valid configure message", () => {
    expect(isControlMessage({ type: "configure", idleThresholdMs: 5000 })).toBe(true);
  });

  test("accepts valid cursor message", () => {
    expect(isControlMessage({ type: "cursor", cursor: 42 })).toBe(true);
  });

  test("accepts valid idle message", () => {
    expect(isControlMessage({ type: "idle" })).toBe(true);
  });

  test("accepts valid active message", () => {
    expect(isControlMessage({ type: "active" })).toBe(true);
  });

  test("accepts valid replay-done message", () => {
    expect(isControlMessage({ type: "replay-done" })).toBe(true);
  });

  test("rejects null", () => {
    expect(isControlMessage(null)).toBe(false);
  });

  test("rejects undefined", () => {
    expect(isControlMessage(undefined)).toBe(false);
  });

  test("rejects primitive string", () => {
    expect(isControlMessage("ping")).toBe(false);
  });

  test("rejects primitive number", () => {
    expect(isControlMessage(42)).toBe(false);
  });

  test("rejects object without type", () => {
    expect(isControlMessage({ cols: 80 })).toBe(false);
  });

  test("rejects object with non-string type", () => {
    expect(isControlMessage({ type: 123 })).toBe(false);
  });
});
