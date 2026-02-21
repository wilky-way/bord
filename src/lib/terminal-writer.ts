/**
 * Micro-batching writer for terminal output.
 * Collects WebSocket messages within a single microtask and flushes
 * them together, preventing render thrashing under heavy output.
 */
export function createTerminalWriter(terminal: { write(data: string | Uint8Array): void }) {
  let pending: (string | Uint8Array)[] = [];
  let scheduled = false;
  let disposed = false;

  function flush() {
    if (disposed) return;
    const batch = pending;
    pending = [];
    scheduled = false;
    for (const chunk of batch) {
      terminal.write(chunk);
    }
  }

  return {
    write(data: string | Uint8Array) {
      if (disposed) return;
      pending.push(data);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    },
    dispose() {
      disposed = true;
      pending = [];
    },
  };
}
