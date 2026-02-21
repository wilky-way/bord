import type { Component } from "solid-js";
import type { Provider } from "../store/types";
import { ClaudeIcon, CodexIcon, OpenCodeIcon, GeminiIcon } from "../components/icons/ProviderIcons";

export const PROVIDER_COLORS: Record<Provider, string> = {
  claude: "#D97757",
  codex: "#60A5FA",
  opencode: "#9CA3AF",
  gemini: "#34D399",
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  claude: "Claude",
  codex: "Codex",
  opencode: "OpenCode",
  gemini: "Gemini",
};

export const PROVIDER_ICONS: Record<Provider, Component<{ size?: number; class?: string }>> = {
  claude: ClaudeIcon,
  codex: CodexIcon,
  opencode: OpenCodeIcon,
  gemini: GeminiIcon,
};

export const PROVIDER_COMMANDS: Record<Provider, string> = {
  claude: "claude",
  codex: "codex",
  opencode: "opencode",
  gemini: "gemini",
};

const COMMAND_TO_PROVIDER: Record<string, Provider> = Object.fromEntries(
  Object.entries(PROVIDER_COMMANDS).map(([p, cmd]) => [cmd, p as Provider]),
);

export function getProviderFromCommand(command?: string[]): Provider | undefined {
  if (!command?.[0]) return undefined;
  // Handle full paths like /usr/local/bin/claude
  const bin = command[0].split("/").pop() ?? command[0];
  return COMMAND_TO_PROVIDER[bin];
}
