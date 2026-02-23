import type { SessionInfo } from "./session-scanner";

export interface ServerProviderDefinition {
  id: string;
  scanSessions: (projectPath?: string) => Promise<SessionInfo[]>;
}

const registry = new Map<string, ServerProviderDefinition>();

export function registerServerProvider(def: ServerProviderDefinition): void {
  registry.set(def.id, def);
}

export function getServerProvider(id: string): ServerProviderDefinition | undefined {
  return registry.get(id);
}

export function listServerProviders(): ServerProviderDefinition[] {
  return [...registry.values()];
}

export function scanSessionsFromRegistry(projectPath?: string, providerId?: string): Promise<SessionInfo[]> {
  if (providerId) {
    const provider = registry.get(providerId);
    if (provider) return provider.scanSessions(projectPath);
    return Promise.resolve([]);
  }
  // Default: scan only the first registered provider (claude) for backward compat
  const first = registry.values().next();
  if (first.done) return Promise.resolve([]);
  return first.value.scanSessions(projectPath);
}
