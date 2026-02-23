import { createSignal } from "solid-js";
import { api } from "../lib/api";

export interface FeatureFlags {
  git: boolean;
  docker: boolean;
  sessions: boolean;
  providers: Record<string, boolean>;
}

const DEFAULT_FLAGS: FeatureFlags = {
  git: true,
  docker: true,
  sessions: true,
  providers: {
    claude: true,
    codex: true,
    opencode: true,
    gemini: true,
  },
};

const [features, setFeatures] = createSignal<FeatureFlags>({ ...DEFAULT_FLAGS, providers: { ...DEFAULT_FLAGS.providers } });

export function getFeatures(): FeatureFlags {
  return features();
}

export async function loadFeatures(): Promise<void> {
  try {
    const flags = await api.getFeatures();
    setFeatures(flags);
  } catch {
    // Server may not support features yet; use defaults
  }
}

export async function updateFeatures(patch: Partial<FeatureFlags>): Promise<void> {
  try {
    const updated = await api.updateFeatures(patch);
    setFeatures(updated);
  } catch {
    // Optimistically apply locally on failure
    setFeatures((prev) => ({
      git: patch.git ?? prev.git,
      docker: patch.docker ?? prev.docker,
      sessions: patch.sessions ?? prev.sessions,
      providers: { ...prev.providers, ...(patch.providers ?? {}) },
    }));
  }
}

export function isFeatureEnabled(name: string): boolean {
  const f = features();
  if (name === "git") return f.git;
  if (name === "docker") return f.docker;
  if (name === "sessions") return f.sessions;
  return true;
}

export function isProviderEnabled(id: string): boolean {
  return features().providers[id] ?? true;
}
