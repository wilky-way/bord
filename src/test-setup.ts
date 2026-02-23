// Test preload — provides browser globals that SolidJS modules expect at import time.

const storage = new Map<string, string>();

globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (i: number) => [...storage.keys()][i] ?? null,
} as Storage;

// Minimal document stub for theme.ts applyTheme
const styleProps = new Map<string, string>();
globalThis.document = {
  documentElement: {
    style: {
      setProperty: (k: string, v: string) => styleProps.set(k, v),
      getPropertyValue: (k: string) => styleProps.get(k) ?? "",
      removeProperty: (k: string) => { styleProps.delete(k); return ""; },
    },
  },
} as any;

// Expose the backing stores so tests can inspect/reset them
(globalThis as any).__testStorage = storage;
(globalThis as any).__testStyleProps = styleProps;
