import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { themes } from "../../lib/themes";
import { activeTheme, setTheme } from "../../lib/theme";
import { getSettings, updateSettings, requestOsNotificationPermission } from "../../lib/notifications/store";
import { sendConfigureToAll } from "../../lib/ws";
import { fontFamily, setFontFamily, FONT_PRESETS } from "../../store/settings";
import type { BordTheme } from "../../lib/themes";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Section = "appearance" | "notifications";

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
            <NavItem
              label="Notifications"
              active={section() === "notifications"}
              onClick={() => setSection("notifications")}
              icon={
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
                  <path d="M6.5 12a1.5 1.5 0 003 0" />
                </svg>
              }
            />
          </div>

          {/* Content area */}
          <div class="flex-1 overflow-y-auto p-5">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-sm font-semibold text-[var(--text-primary)]">
                {section() === "appearance" ? "Appearance" : "Notifications"}
              </h3>
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

            <Show when={section() === "appearance"}>
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

              <label class="text-xs font-medium text-[var(--text-secondary)] mt-5 mb-2 block">Terminal Font</label>
              <FontPicker />
            </Show>

            <Show when={section() === "notifications"}>
              <NotificationSettings />
            </Show>
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

function ToggleRow(props: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="flex items-center justify-between py-2 cursor-pointer group">
      <div>
        <div class="text-xs font-medium text-[var(--text-primary)]">{props.label}</div>
        <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">{props.description}</div>
      </div>
      <button
        class="relative w-8 h-[18px] rounded-full transition-colors shrink-0 ml-3"
        style={{
          background: props.checked
            ? "var(--accent)"
            : "var(--bg-tertiary)",
        }}
        onClick={() => props.onChange(!props.checked)}
      >
        <span
          class="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform"
          style={{
            transform: props.checked ? "translateX(16px)" : "translateX(2px)",
          }}
        />
      </button>
    </label>
  );
}

function NotificationSettings() {
  const s = () => getSettings();

  return (
    <div class="space-y-4">
      <div>
        <label class="text-xs font-medium text-[var(--text-secondary)] mb-2 block">Sounds</label>
        <div class="space-y-1">
          <ToggleRow
            label="Agent done"
            description="Play a chime when an agent finishes (goes idle)"
            checked={s().soundEnabled}
            onChange={(v) => updateSettings({ soundEnabled: v })}
          />
          <ToggleRow
            label="Error alert"
            description="Play a distinct sound on error notifications"
            checked={s().errorSoundEnabled}
            onChange={(v) => updateSettings({ errorSoundEnabled: v })}
          />
        </div>
      </div>

      <div>
        <label class="text-xs font-medium text-[var(--text-secondary)] mb-2 block">OS Notifications</label>
        <ToggleRow
          label="Desktop notifications"
          description="Show OS notifications when the app is not focused"
          checked={s().osNotificationsEnabled}
          onChange={(v) => {
            if (v) requestOsNotificationPermission();
            updateSettings({ osNotificationsEnabled: v });
          }}
        />
      </div>

      <div>
        <label class="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
          Idle threshold: {(s().idleThresholdMs / 1000).toFixed(0)}s
        </label>
        <div class="flex items-center gap-3">
          <span class="text-[10px] text-[var(--text-secondary)]">5s</span>
          <input
            type="range"
            min="5000"
            max="30000"
            step="1000"
            value={s().idleThresholdMs}
            class="flex-1 accent-[var(--accent)]"
            onInput={(e) => {
              const val = parseInt(e.currentTarget.value, 10);
              updateSettings({ idleThresholdMs: val });
              sendConfigureToAll(val);
            }}
          />
          <span class="text-[10px] text-[var(--text-secondary)]">30s</span>
        </div>
        <p class="text-[10px] text-[var(--text-secondary)] mt-1">
          How long a terminal must be silent before triggering a notification
        </p>
      </div>
    </div>
  );
}

function FontPicker() {
  const [custom, setCustom] = createSignal(false);
  const isPreset = () => FONT_PRESETS.some((p) => p.value === fontFamily());

  return (
    <div class="space-y-2">
      <select
        class="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded-md px-2 py-1.5 border border-[var(--border)] outline-none focus:border-[var(--accent)]"
        value={isPreset() && !custom() ? fontFamily() : "__custom__"}
        onChange={(e) => {
          const val = e.currentTarget.value;
          if (val === "__custom__") {
            setCustom(true);
          } else {
            setCustom(false);
            setFontFamily(val);
          }
        }}
      >
        <For each={FONT_PRESETS}>
          {(preset) => <option value={preset.value}>{preset.label}</option>}
        </For>
        <option value="__custom__">Custom...</option>
      </select>
      <Show when={custom() || !isPreset()}>
        <input
          class="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded-md px-2 py-1.5 border border-[var(--border)] outline-none focus:border-[var(--accent)]"
          placeholder='e.g. "My Font", monospace'
          value={fontFamily()}
          onInput={(e) => setFontFamily(e.currentTarget.value)}
        />
      </Show>
      <p class="text-[10px] text-[var(--text-secondary)]">
        Install a <a href="https://www.nerdfonts.com/" target="_blank" class="text-[var(--accent)] hover:underline">Nerd Font</a> for powerlevel10k icons
      </p>
    </div>
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
