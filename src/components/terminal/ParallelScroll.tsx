// ParallelScroll: Sync scroll position across multiple terminal panels
// Uses fraction-based sync to normalize across different buffer sizes

import { createSignal } from "solid-js";

const [scrollSyncEnabled, setScrollSyncEnabled] = createSignal(false);
const [scrollSource, setScrollSource] = createSignal<string | null>(null);

// Registry of terminal scroll callbacks
const scrollHandlers = new Map<
  string,
  {
    getScrollFraction: () => number;
    setScrollFraction: (fraction: number) => void;
  }
>();

export function registerTerminal(
  id: string,
  handlers: {
    getScrollFraction: () => number;
    setScrollFraction: (fraction: number) => void;
  },
) {
  scrollHandlers.set(id, handlers);
}

export function unregisterTerminal(id: string) {
  scrollHandlers.delete(id);
}

export function onTerminalScroll(sourceId: string) {
  if (!scrollSyncEnabled()) return;
  if (scrollSource() && scrollSource() !== sourceId) return; // prevent feedback loop

  const source = scrollHandlers.get(sourceId);
  if (!source) return;

  setScrollSource(sourceId);
  const fraction = source.getScrollFraction();

  for (const [id, handler] of scrollHandlers) {
    if (id !== sourceId) {
      handler.setScrollFraction(fraction);
    }
  }

  // Clear source flag after microtask to allow next scroll event
  queueMicrotask(() => setScrollSource(null));
}

export { scrollSyncEnabled, setScrollSyncEnabled };
