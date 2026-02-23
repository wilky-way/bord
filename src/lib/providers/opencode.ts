import { OpenCodeIcon } from "../../components/icons/ProviderIcons";
import { valueAfterFlag } from "./utils";
import type { ProviderDefinition } from "./registry";

export const opencodeProvider: ProviderDefinition = {
  id: "opencode",
  label: "OpenCode",
  color: "#9CA3AF",
  icon: OpenCodeIcon,
  command: "opencode",
  enabled: true,
  buildNewSessionCommand: () => ["opencode"],
  buildResumeCommand: (sessionId: string) => ["opencode", "--session", sessionId],
  getResumeSessionId: (command: string[]) => valueAfterFlag(command, "--session", "-s"),
};
