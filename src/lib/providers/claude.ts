import { ClaudeIcon } from "../../components/icons/ProviderIcons";
import { valueAfterFlag } from "./utils";
import type { ProviderDefinition } from "./registry";

export const claudeProvider: ProviderDefinition = {
  id: "claude",
  label: "Claude",
  color: "#D97757",
  icon: ClaudeIcon,
  command: "claude",
  enabled: true,
  buildNewSessionCommand: () => ["claude"],
  buildResumeCommand: (sessionId: string) => ["claude", "--resume", sessionId],
  getResumeSessionId: (command: string[]) => valueAfterFlag(command, "--resume", "-r"),
};
