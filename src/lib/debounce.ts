/**
 * Single-action debouncer. Delays execution until `delayMs` after the last call.
 */
export function createBurstCoalescer(delayMs: number, action: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    trigger() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        action();
      }, delayMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

/**
 * Keyed batch coalescer. Collects keyed values and flushes them in a batch
 * after `delayMs` of inactivity. Deduplicates by key (last value wins).
 */
export function createKeyedBatchCoalescer<K, V>(
  delayMs: number,
  onFlush: (batch: Map<K, V>) => void,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pending = new Map<K, V>();

  return {
    enqueue(key: K, value: V) {
      pending.set(key, value);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const batch = new Map(pending);
        pending.clear();
        onFlush(batch);
      }, delayMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending.clear();
    },
  };
}
