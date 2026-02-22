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

function commandBin(command: string): string {
  const bin = command.split(/[\\/]/).pop() ?? command;
  return bin.replace(/\.(exe|cmd|bat)$/i, "").toLowerCase();
}

export function getProviderFromCommand(command?: string[]): Provider | undefined {
  if (!command?.[0]) return undefined;
  // Handle full paths like /usr/local/bin/claude or C:\\bin\\claude.exe
  const bin = commandBin(command[0]);
  return COMMAND_TO_PROVIDER[bin];
}

export function buildResumeCommand(provider: Provider, sessionId: string): string[] {
  switch (provider) {
    case "claude":
      return ["claude", "--resume", sessionId];
    case "codex":
      return ["codex", "resume", sessionId];
    case "opencode":
      return ["opencode", "--session", sessionId];
    case "gemini":
      // Placeholder until Gemini session discovery/resume is implemented.
      return ["gemini", "--resume", sessionId];
  }
}

export function buildNewSessionCommand(provider: Provider): string[] {
  return [PROVIDER_COMMANDS[provider]];
}

export function getResumeSessionId(command?: string[]): string | undefined {
  if (!command?.length) return undefined;

  const provider = getProviderFromCommand(command);

  const valueAfterFlag = (longFlag: string, shortFlag?: string) => {
    const longInline = command.find((arg) => arg.startsWith(`${longFlag}=`));
    if (longInline) {
      const [, value] = longInline.split("=", 2);
      if (value) return value;
    }

    const longIndex = command.indexOf(longFlag);
    if (longIndex !== -1 && longIndex + 1 < command.length) {
      return command[longIndex + 1];
    }
    if (shortFlag) {
      const shortIndex = command.indexOf(shortFlag);
      if (shortIndex !== -1 && shortIndex + 1 < command.length) {
        return command[shortIndex + 1];
      }
    }
    return undefined;
  };

  if (provider === "codex") {
    const resumeIndex = command.indexOf("resume");
    if (resumeIndex !== -1 && resumeIndex + 1 < command.length) {
      const value = command[resumeIndex + 1];
      if (!value.startsWith("-")) return value;
    }
    return undefined;
  }

  if (provider === "opencode") {
    return valueAfterFlag("--session", "-s");
  }

  if (provider === "claude" || provider === "gemini") {
    return valueAfterFlag("--resume", "-r");
  }

  // Unknown binaries: keep backward-compat support for --resume.
  return valueAfterFlag("--resume", "-r");
}
