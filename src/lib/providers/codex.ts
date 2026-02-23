import { CodexIcon } from "../../components/icons/ProviderIcons";
import type { ProviderDefinition } from "./registry";

export const codexProvider: ProviderDefinition = {
  id: "codex",
  label: "Codex",
  color: "#60A5FA",
  icon: CodexIcon,
  command: "codex",
  enabled: true,
  buildNewSessionCommand: () => ["codex"],
  buildResumeCommand: (sessionId: string) => ["codex", "resume", sessionId],
  getResumeSessionId: (command: string[]) => {
    const resumeIndex = command.indexOf("resume");
    if (resumeIndex !== -1 && resumeIndex + 1 < command.length) {
      const value = command[resumeIndex + 1];
      if (!value.startsWith("-")) return value;
    }
    return undefined;
  },
};
