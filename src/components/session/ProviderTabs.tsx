import { For, Show, type JSX } from "solid-js";
import { state, setState } from "../../store/core";
import { PROVIDER_COLORS, PROVIDER_ICONS, PROVIDER_LABELS } from "../../lib/providers";
import type { Provider } from "../../store/types";

const PROVIDERS: Provider[] = ["claude", "codex", "opencode", "gemini"];

interface Props {
  actions?: JSX.Element;
}

export default function ProviderTabs(props: Props) {
  return (
    <div class="flex items-center justify-center gap-3 py-1.5">
      <For each={PROVIDERS}>
        {(provider) => {
          const Icon = PROVIDER_ICONS[provider];
          const isActive = () => state.activeProvider === provider;
          return (
            <button
              class="relative flex items-center justify-center w-7 h-7 rounded transition-opacity"
              classList={{
                "opacity-100": isActive(),
                "opacity-35 hover:opacity-60": !isActive(),
              }}
              onClick={() => setState("activeProvider", provider)}
              title={PROVIDER_LABELS[provider]}
            >
              <Icon size={16} />
              <div
                class="absolute bottom-0 left-1 right-1 h-[2px] rounded-full transition-opacity"
                style={{ background: PROVIDER_COLORS[provider] }}
                classList={{
                  "opacity-100": isActive(),
                  "opacity-0": !isActive(),
                }}
              />
            </button>
          );
        }}
      </For>
      <Show when={props.actions}>{props.actions}</Show>
    </div>
  );
}
