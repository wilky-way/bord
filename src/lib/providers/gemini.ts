import { GeminiIcon } from "../../components/icons/ProviderIcons";
import { valueAfterFlag } from "./utils";
import type { ProviderDefinition } from "./registry";

export const geminiProvider: ProviderDefinition = {
  id: "gemini",
  label: "Gemini",
  color: "#34D399",
  icon: GeminiIcon,
  command: "gemini",
  enabled: true,
  buildNewSessionCommand: () => ["gemini"],
  buildResumeCommand: (sessionId: string) => ["gemini", "--resume", sessionId],
  getResumeSessionId: (command: string[]) => valueAfterFlag(command, "--resume", "-r"),
};
