import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { themes } from "../../lib/themes";
import { activeTheme, setTheme } from "../../lib/theme";
import type { BordTheme } from "../../lib/themes";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Section = "appearance";

export default function SettingsPanel(props: Props) {
  const [section, setSection] = createSignal<Section>("appearance");
  let backdropRef!: HTMLDivElement;

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === backdropRef) props.onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") props.onClose();
  }

  onMount(() => document.addEventListener("keydown", handleKeyDown));
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  return (
    <Show when={props.open}>
      <div
        ref={backdropRef}
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 popover-appear"
        onClick={handleBackdropClick}
      >
        <div class="w-[680px] max-h-[80vh] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-lg overflow-hidden flex">
          {/* Left nav */}
          <div class="w-[180px] flex-shrink-0 border-r border-[var(--border)] p-3 flex flex-col gap-1">
            <h2 class="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 px-2">Settings</h2>
            <NavItem
              label="Appearance"
              active={section() === "appearance"}
              onClick={() => setSection("appearance")}
              icon={
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="8" cy="8" r="5" />
                  <path d="M8 3v10" />
                  <path d="M8 3a5 5 0 0 1 0 10" fill="currentColor" opacity="0.3" />
                </svg>
              }
            />
          </div>

          {/* Content area */}
          <div class="flex-1 overflow-y-auto p-5">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-sm font-semibold text-[var(--text-primary)]">Appearance</h3>
              <button
                class="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={props.onClose}
                title="Close"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <label class="text-xs font-medium text-[var(--text-secondary)] mb-3 block">Theme</label>
            <div class="grid grid-cols-3 gap-3">
              <For each={themes}>
                {(theme) => (
                  <ThemeSwatch
                    theme={theme}
                    active={activeTheme().id === theme.id}
                    onClick={() => setTheme(theme.id)}
                  />
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

function NavItem(props: { label: string; active: boolean; onClick: () => void; icon: any; disabled?: boolean }) {
  return (
    <button
      class={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors w-full text-left ${
        props.active
          ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
      } ${props.disabled ? "opacity-40 pointer-events-none" : ""}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

function ThemeSwatch(props: { theme: BordTheme; active: boolean; onClick: () => void }) {
  const t = () => props.theme;
  return (
    <button
      class={`rounded-lg overflow-hidden border-2 transition-all cursor-pointer hover:scale-[1.03] ${
        props.active
          ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
          : "border-transparent hover:border-[var(--border)]"
      }`}
      onClick={props.onClick}
      title={t().name}
    >
      {/* Mini terminal preview */}
      <div
        class="h-[72px] p-2 flex flex-col gap-1"
        style={{ background: t().terminal.background }}
      >
        {/* Fake title bar dots */}
        <div class="flex gap-1 mb-0.5">
          <div class="w-1.5 h-1.5 rounded-full" style={{ background: t().terminal.red }} />
          <div class="w-1.5 h-1.5 rounded-full" style={{ background: t().terminal.yellow }} />
          <div class="w-1.5 h-1.5 rounded-full" style={{ background: t().terminal.green }} />
        </div>
        {/* Fake terminal lines */}
        <div class="flex items-center gap-1">
          <div class="h-1.5 w-4 rounded-sm" style={{ background: t().terminal.green, opacity: 0.9 }} />
          <div class="h-1.5 w-8 rounded-sm" style={{ background: t().terminal.foreground, opacity: 0.5 }} />
        </div>
        <div class="flex items-center gap-1">
          <div class="h-1.5 w-3 rounded-sm" style={{ background: t().terminal.blue, opacity: 0.9 }} />
          <div class="h-1.5 w-6 rounded-sm" style={{ background: t().terminal.yellow, opacity: 0.7 }} />
          <div class="h-1.5 w-10 rounded-sm" style={{ background: t().terminal.foreground, opacity: 0.4 }} />
        </div>
        <div class="flex items-center gap-1">
          <div class="h-1.5 w-5 rounded-sm" style={{ background: t().terminal.magenta, opacity: 0.8 }} />
          <div class="h-1.5 w-7 rounded-sm" style={{ background: t().terminal.cyan, opacity: 0.6 }} />
        </div>
      </div>
      {/* Chrome preview strip */}
      <div
        class="px-2 py-1.5 flex items-center justify-between"
        style={{ background: t().chrome.bgSecondary }}
      >
        <span
          class="text-[10px] font-medium truncate"
          style={{ color: t().chrome.textPrimary }}
        >
          {t().name}
        </span>
        <div class="flex gap-0.5">
          <div class="w-2 h-2 rounded-full" style={{ background: t().chrome.accent }} />
        </div>
      </div>
    </button>
  );
}
