import type { Component } from "solid-js";
import type { Provider } from "../../store/types";
import { registerProvider, getProvider, listProviders, enabledProviders, setProviderEnabled } from "./registry";
import type { ProviderDefinition } from "./registry";
import { commandBin, valueAfterFlag } from "./utils";
import { claudeProvider } from "./claude";
import { codexProvider } from "./codex";
import { opencodeProvider } from "./opencode";
import { geminiProvider } from "./gemini";

// Register all providers
registerProvider(claudeProvider);
registerProvider(codexProvider);
registerProvider(opencodeProvider);
registerProvider(geminiProvider);

// Re-export registry API
export { registerProvider, getProvider, listProviders, enabledProviders, setProviderEnabled };
export type { ProviderDefinition };

// -----------------------------------------------------------------------
// Backward-compatible exports matching the old src/lib/providers.ts API
// -----------------------------------------------------------------------

export const PROVIDER_COLORS: Record<Provider, string> = {
  claude: claudeProvider.color,
  codex: codexProvider.color,
  opencode: opencodeProvider.color,
  gemini: geminiProvider.color,
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  claude: claudeProvider.label,
  codex: codexProvider.label,
  opencode: opencodeProvider.label,
  gemini: geminiProvider.label,
};

export const PROVIDER_ICONS: Record<Provider, Component<{ size?: number; class?: string }>> = {
  claude: claudeProvider.icon,
  codex: codexProvider.icon,
  opencode: opencodeProvider.icon,
  gemini: geminiProvider.icon,
};

export const PROVIDER_COMMANDS: Record<Provider, string> = {
  claude: claudeProvider.command,
  codex: codexProvider.command,
  opencode: opencodeProvider.command,
  gemini: geminiProvider.command,
};

const COMMAND_TO_PROVIDER: Record<string, Provider> = Object.fromEntries(
  Object.entries(PROVIDER_COMMANDS).map(([p, cmd]) => [cmd, p as Provider]),
);

export function getProviderFromCommand(command?: string[]): Provider | undefined {
  if (!command?.[0]) return undefined;
  const bin = commandBin(command[0]);
  return COMMAND_TO_PROVIDER[bin];
}

export function buildResumeCommand(provider: Provider, sessionId: string): string[] {
  const def = getProvider(provider);
  if (def) return def.buildResumeCommand(sessionId);
  // Fallback for unknown providers
  return [provider, "--resume", sessionId];
}

export function buildNewSessionCommand(provider: Provider): string[] {
  const def = getProvider(provider);
  if (def) return def.buildNewSessionCommand();
  return [provider];
}

export function getResumeSessionId(command?: string[]): string | undefined {
  if (!command?.length) return undefined;

  const provider = getProviderFromCommand(command);
  const def = provider ? getProvider(provider) : undefined;

  if (def) return def.getResumeSessionId(command);

  // Unknown binaries: keep backward-compat support for --resume
  return valueAfterFlag(command, "--resume", "-r");
}
