import { Show } from "solid-js";

interface Props {
  armed: boolean;
  muted: boolean;
  globalMuted: boolean;
  onMuteToggle: () => void;
}

export default function WarmupIndicator(props: Props) {
  const effectivelyMuted = () => props.muted || props.globalMuted;

  const BellIcon = () => (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
      <path d="M6.5 12a1.5 1.5 0 003 0" />
    </svg>
  );

  const BellMutedIcon = () => (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
      <path d="M6.5 12a1.5 1.5 0 003 0" />
      <path d="M2 2l12 12" />
    </svg>
  );

  const PillBell = () => (
    <svg
      width="9" height="9" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      class="relative z-10 warmup-bell-steady"
      style={{ color: "var(--success)" }}
    >
      <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
      <path d="M6.5 12a1.5 1.5 0 003 0" />
    </svg>
  );

  return (
    <Show when={!effectivelyMuted()} fallback={
      <button
        class="shrink-0 flex items-center justify-center rounded-[var(--btn-radius)] transition-colors text-[var(--text-secondary)] opacity-50 hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); props.onMuteToggle(); }}
        title="Unmute notifications"
      >
        <BellMutedIcon />
      </button>
    }>
      <Show when={props.armed} fallback={
        <span class="shrink-0 text-[var(--text-secondary)] opacity-20" title="Notifications not armed">
          <BellIcon />
        </span>
      }>
        <div
          class="shrink-0 flex items-center gap-1 px-1.5 rounded-full overflow-hidden relative cursor-pointer warmup-green-pulse"
          style={{ height: "16px", "min-width": "36px" }}
          title="Notifications armed — click to mute"
          onClick={(e) => { e.stopPropagation(); props.onMuteToggle(); }}
        >
          {/* Background */}
          <div
            class="absolute inset-0 rounded-full"
            style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)" }}
          />
          {/* Fill */}
          <div
            class="absolute left-0 top-0 h-full w-full rounded-full"
            style={{ background: "color-mix(in srgb, var(--success) 25%, transparent)" }}
          />
          <PillBell />
          <span
            class="relative text-[9px] font-mono z-10 leading-none"
            style={{ color: "var(--success)" }}
          >
            ON
          </span>
        </div>
      </Show>
    </Show>
  );
}
