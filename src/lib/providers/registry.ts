import { createSignal } from "solid-js";
import type { Component } from "solid-js";

export interface ProviderDefinition {
  id: string;
  label: string;
  color: string;
  icon: Component<{ size?: number; class?: string }>;
  command: string;
  enabled: boolean;
  buildNewSessionCommand: () => string[];
  buildResumeCommand: (sessionId: string) => string[];
  getResumeSessionId: (command: string[]) => string | undefined;
}

const [providers, setProviders] = createSignal<Map<string, ProviderDefinition>>(new Map());

export function registerProvider(def: ProviderDefinition): void {
  setProviders((prev) => {
    const next = new Map(prev);
    next.set(def.id, def);
    return next;
  });
}

export function getProvider(id: string): ProviderDefinition | undefined {
  return providers().get(id);
}

export function listProviders(): ProviderDefinition[] {
  return [...providers().values()];
}

export function enabledProviders(): ProviderDefinition[] {
  return [...providers().values()].filter((p) => p.enabled);
}

export function setProviderEnabled(id: string, enabled: boolean): void {
  setProviders((prev) => {
    const next = new Map(prev);
    const def = next.get(id);
    if (def) next.set(id, { ...def, enabled });
    return next;
  });
}
