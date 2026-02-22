import { describe, expect, test, beforeEach, afterEach, jest } from "bun:test";
import { createBurstCoalescer, createKeyedBatchCoalescer } from "./debounce";

describe("createBurstCoalescer", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("triggers action after delay", () => {
    let called = 0;
    const coalescer = createBurstCoalescer(100, () => called++);

    coalescer.trigger();
    expect(called).toBe(0);

    jest.advanceTimersByTime(100);
    expect(called).toBe(1);
  });

  test("coalesces rapid triggers into single action", () => {
    let called = 0;
    const coalescer = createBurstCoalescer(100, () => called++);

    coalescer.trigger();
    jest.advanceTimersByTime(50);
    coalescer.trigger();
    jest.advanceTimersByTime(50);
    coalescer.trigger();
    jest.advanceTimersByTime(100);

    expect(called).toBe(1);
  });

  test("cancel prevents firing", () => {
    let called = 0;
    const coalescer = createBurstCoalescer(100, () => called++);

    coalescer.trigger();
    jest.advanceTimersByTime(50);
    coalescer.cancel();
    jest.advanceTimersByTime(100);

    expect(called).toBe(0);
  });

  test("can re-trigger after cancel", () => {
    let called = 0;
    const coalescer = createBurstCoalescer(100, () => called++);

    coalescer.trigger();
    coalescer.cancel();
    coalescer.trigger();
    jest.advanceTimersByTime(100);

    expect(called).toBe(1);
  });

  test("cancel is idempotent", () => {
    const coalescer = createBurstCoalescer(100, () => {});
    coalescer.cancel();
    coalescer.cancel();
    coalescer.cancel();
    // Should not throw
  });
});

describe("createKeyedBatchCoalescer", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("flushes batch after delay", () => {
    let flushed: Map<string, number> | null = null;
    const coalescer = createKeyedBatchCoalescer<string, number>(100, (batch) => {
      flushed = batch;
    });

    coalescer.enqueue("a", 1);
    coalescer.enqueue("b", 2);
    jest.advanceTimersByTime(100);

    expect(flushed).not.toBeNull();
    expect(flushed!.get("a")).toBe(1);
    expect(flushed!.get("b")).toBe(2);
  });

  test("last value wins for same key", () => {
    let flushed: Map<string, number> | null = null;
    const coalescer = createKeyedBatchCoalescer<string, number>(100, (batch) => {
      flushed = batch;
    });

    coalescer.enqueue("a", 1);
    coalescer.enqueue("a", 2);
    coalescer.enqueue("a", 3);
    jest.advanceTimersByTime(100);

    expect(flushed!.size).toBe(1);
    expect(flushed!.get("a")).toBe(3);
  });

  test("cancel clears pending batch", () => {
    let flushed = false;
    const coalescer = createKeyedBatchCoalescer<string, number>(100, () => {
      flushed = true;
    });

    coalescer.enqueue("a", 1);
    coalescer.cancel();
    jest.advanceTimersByTime(200);

    expect(flushed).toBe(false);
  });

  test("resets delay on new enqueue", () => {
    let flushCount = 0;
    const coalescer = createKeyedBatchCoalescer<string, number>(100, () => {
      flushCount++;
    });

    coalescer.enqueue("a", 1);
    jest.advanceTimersByTime(80);
    coalescer.enqueue("b", 2);
    jest.advanceTimersByTime(80);
    // 160ms total but only 80ms since last enqueue — not yet flushed
    expect(flushCount).toBe(0);

    jest.advanceTimersByTime(20);
    expect(flushCount).toBe(1);
  });
});
