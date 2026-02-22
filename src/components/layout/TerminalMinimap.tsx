import { For, Show } from "solid-js";
import { state } from "../../store/core";
import { setActiveTerminal, getVisibleTerminals } from "../../store/terminals";
import { notificationIndex } from "../../lib/notifications/index";
import { PROVIDER_COLORS, PROVIDER_ICONS } from "../../lib/providers";

export default function TerminalMinimap() {
  const visible = () => getVisibleTerminals();

  return (
    <Show when={visible().length > 0}>
      <div class="flex items-center gap-1">
        <For each={visible()}>
          {(term) => {
            const isActive = () => term.id === state.activeTerminalId;
            const hasNotif = () => (notificationIndex().byTerminal.get(term.id)?.unseen ?? 0) > 0;
            return (
              <div class="relative group">
                <button
                  class="h-3.5 rounded transition-all"
                  classList={{
                    "w-6": isActive(),
                    "w-4": !isActive(),
                    "opacity-40 hover:opacity-70": !isActive() && !hasNotif() && !!term.provider,
                    "opacity-30 hover:opacity-60": !isActive() && !hasNotif() && !term.provider,
                    "animate-pulse": hasNotif(),
                  }}
                  style={{
                    "background-color": hasNotif()
                      ? "var(--warning)"
                      : term.provider
                        ? PROVIDER_COLORS[term.provider]
                        : "var(--accent)",
                  }}
                  onClick={() => setActiveTerminal(term.id)}
                />
                {/* Tooltip */}
                <div class="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-0.5 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-[10px] text-[var(--text-primary)] whitespace-nowrap z-50 shadow-lg">
                  <div class="flex items-center gap-1">
                    <Show when={term.provider}>
                      {(() => {
                        const Icon = PROVIDER_ICONS[term.provider!];
                        return <Icon size={10} />;
                      })()}
                    </Show>
                    <span>{term.customTitle || term.sessionTitle || term.title}</span>
                  </div>
                  <span class="text-[var(--text-secondary)]">{term.cwd}</span>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
