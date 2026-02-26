import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { getSettings } from "../../lib/notifications/store";

interface Props {
  armed: boolean;
  warmupStartedAt?: number;
  muted: boolean;
  globalMuted: boolean;
  onMuteToggle: () => void;
}

type Phase = "waiting" | "red" | "yellow" | "green";

export default function WarmupIndicator(props: Props) {
  const effectivelyMuted = () => props.muted || props.globalMuted;
  const [phase, setPhase] = createSignal<Phase>("waiting");
  const [progress, setProgress] = createSignal(0);
  const [remaining, setRemaining] = createSignal(0);

  const warmupMs = () => getSettings().warmupDurationMs;

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stopTicking = () => {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
  };

  const phaseColor = () => {
    switch (phase()) {
      case "red": return "var(--danger)";
      case "yellow": return "var(--warning)";
      case "green": return "var(--success)";
      default: return "var(--text-secondary)";
    }
  };

  const tick = () => {
    const start = props.warmupStartedAt;
    const duration = warmupMs();

    if (!start || duration <= 0) {
      setPhase(props.armed ? "green" : "waiting");
      setProgress(props.armed ? 1 : 0);
      setRemaining(0);
      stopTicking();
      return;
    }

    const elapsed = Date.now() - start;
    const ratio = Math.min(1, Math.max(0, elapsed / duration));
    setProgress(ratio);
    setRemaining(Math.max(0, Math.ceil((duration - elapsed) / 1000)));

    if (props.armed || ratio >= 1) {
      setPhase("green");
      stopTicking();
      return;
    }

    if (ratio >= 0.6) {
      setPhase("yellow");
    } else {
      setPhase("red");
    }
  };

  createEffect(() => {
    if (props.armed) {
      setPhase("green");
      setProgress(1);
      setRemaining(0);
      stopTicking();
      return;
    }

    const start = props.warmupStartedAt;
    const duration = warmupMs();

    if (!start || duration <= 0) {
      setPhase("waiting");
      setProgress(0);
      setRemaining(0);
      stopTicking();
      return;
    }

    tick();
    if (!intervalId) intervalId = setInterval(tick, 250);
  });

  onCleanup(stopTicking);

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
      class="relative z-10"
      classList={{
        "warmup-bell-ding": phase() === "red" || phase() === "yellow",
        "warmup-bell-steady": phase() === "green",
      }}
      style={{ color: phaseColor() }}
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
        <Show when={phase() !== "waiting"} fallback={
          <span class="shrink-0 text-[var(--text-secondary)] opacity-20" title="Waiting for OSC work signal">
            <BellIcon />
          </span>
        }>
          <div
            class="shrink-0 flex items-center gap-1 px-1.5 rounded-full overflow-hidden relative cursor-pointer"
            classList={{ "warmup-green-pulse": phase() === "green" }}
            style={{ height: "16px", "min-width": "36px" }}
            title={phase() === "green" ? "Notifications armed — click to mute" : `Notifications arm in ${remaining()}s`}
            onClick={(e) => { e.stopPropagation(); props.onMuteToggle(); }}
          >
            {/* Background */}
            <div
              class="absolute inset-0 rounded-full transition-colors duration-500"
              style={{ background: `color-mix(in srgb, ${phaseColor()} 12%, transparent)` }}
            />
            {/* Fill */}
            <div
              class="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress() * 100}%`,
                background: `color-mix(in srgb, ${phaseColor()} 25%, transparent)`,
              }}
            />
            <PillBell />
            <span
              class="relative text-[9px] font-mono z-10 leading-none transition-colors duration-500"
              style={{ color: phaseColor() }}
            >
              {phase() === "green" ? "ON" : `${remaining()}s`}
            </span>
          </div>
        </Show>
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
