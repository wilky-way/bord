/**
 * Micro-batching writer for terminal output.
 * Spreads large bursts across animation frames so replay doesn't block
 * the UI thread.
 */
export function createTerminalWriter(terminal: { write(data: string | Uint8Array): void }) {
  let pending: (string | Uint8Array)[] = [];
  let readIndex = 0;
  let scheduled = false;
  let disposed = false;
  let rafId: number | undefined;
  let timerId: number | undefined;

  const MAX_BYTES_PER_FLUSH = 64 * 1024;
  const MAX_CHUNKS_PER_FLUSH = 32;

  function chunkSize(chunk: string | Uint8Array): number {
    return typeof chunk === "string" ? chunk.length : chunk.byteLength;
  }

  function compactQueue() {
    if (readIndex === 0) return;
    if (readIndex >= pending.length) {
      pending = [];
      readIndex = 0;
      return;
    }

    if (readIndex > 128 && readIndex > pending.length / 2) {
      pending = pending.slice(readIndex);
      readIndex = 0;
    }
  }

  function scheduleFlush() {
    if (scheduled || disposed) return;
    scheduled = true;

    if (typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        flush();
      });
      return;
    }

    timerId = window.setTimeout(() => {
      timerId = undefined;
      flush();
    }, 16);
  }

  function flush() {
    if (disposed) {
      scheduled = false;
      return;
    }

    scheduled = false;

    let writtenBytes = 0;
    let writtenChunks = 0;

    while (readIndex < pending.length && writtenBytes < MAX_BYTES_PER_FLUSH) {
      if (writtenChunks >= MAX_CHUNKS_PER_FLUSH) break;
      const chunk = pending[readIndex++];
      terminal.write(chunk);
      writtenBytes += chunkSize(chunk);
      writtenChunks++;
    }

    compactQueue();

    if (readIndex < pending.length) {
      scheduleFlush();
    }
  }

  return {
    write(data: string | Uint8Array) {
      if (disposed) return;
      pending.push(data);
      scheduleFlush();
    },
    dispose() {
      disposed = true;
      pending = [];
      readIndex = 0;

      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }

      if (timerId !== undefined) {
        clearTimeout(timerId);
        timerId = undefined;
      }

      scheduled = false;
    },
  };
}
