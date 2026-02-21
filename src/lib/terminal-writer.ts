/**
 * Micro-batching writer for terminal output.
 * Collects WebSocket messages within a single microtask and flushes
 * them together, preventing render thrashing under heavy output.
 */
export function createTerminalWriter(terminal: { write(data: string | Uint8Array): void }) {
  let pending: (string | Uint8Array)[] = [];
  let scheduled = false;

  function flush() {
    const batch = pending;
    pending = [];
    scheduled = false;
    for (const chunk of batch) {
      terminal.write(chunk);
    }
  }

  return {
    write(data: string | Uint8Array) {
      pending.push(data);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    },
  };
}
