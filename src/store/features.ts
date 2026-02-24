import { createSignal } from "solid-js";
import { api } from "../lib/api";
import { state, setState } from "./core";
import type { Provider } from "./types";

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

const PROVIDER_ORDER: Provider[] = ["claude", "codex", "opencode", "gemini"];

function getFirstEnabledProvider(flags: FeatureFlags): Provider {
  return PROVIDER_ORDER.find((id) => flags.providers[id] !== false) ?? "claude";
}

function reconcileActiveProvider(flags: FeatureFlags): void {
  if (flags.providers[state.activeProvider] === false) {
    setState("activeProvider", getFirstEnabledProvider(flags));
  }
}

export function getFeatures(): FeatureFlags {
  return features();
}

export async function loadFeatures(): Promise<void> {
  try {
    const flags = await api.getFeatures();
    setFeatures(flags);
    reconcileActiveProvider(flags);
  } catch {
    // Server may not support features yet; use defaults
  }
}

export async function updateFeatures(patch: Partial<FeatureFlags>): Promise<void> {
  try {
    const updated = await api.updateFeatures(patch);
    setFeatures(updated);
    reconcileActiveProvider(updated);
  } catch {
    // Optimistically apply locally on failure
    setFeatures((prev) => {
      const next = {
        git: patch.git ?? prev.git,
        docker: patch.docker ?? prev.docker,
        sessions: patch.sessions ?? prev.sessions,
        providers: { ...prev.providers, ...(patch.providers ?? {}) },
      };
      reconcileActiveProvider(next);
      return next;
    });
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
