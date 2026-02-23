// Re-export everything from the new providers directory for backward compatibility
export {
  PROVIDER_COLORS,
  PROVIDER_LABELS,
  PROVIDER_ICONS,
  PROVIDER_COMMANDS,
  getProviderFromCommand,
  buildResumeCommand,
  buildNewSessionCommand,
  getResumeSessionId,
  registerProvider,
  getProvider,
  listProviders,
  enabledProviders,
  setProviderEnabled,
} from "./providers/index";

export type { ProviderDefinition } from "./providers/registry";
