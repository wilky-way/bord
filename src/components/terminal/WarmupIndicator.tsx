import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { getSettings } from "../../lib/notifications/store";

interface Props {
  firstOutputAt: number | undefined;
  muted: boolean;
  globalMuted: boolean;
  provider: boolean;
  onMuteToggle: () => void;
}

type Phase = "waiting" | "red" | "yellow" | "green";

export default function WarmupIndicator(props: Props) {
  const [phase, setPhase] = createSignal<Phase>("waiting");
  const [progress, setProgress] = createSignal(0);
  const [remaining, setRemaining] = createSignal(0);

  const warmupMs = () => getSettings().warmupDurationMs;
  const effectivelyMuted = () => props.muted || props.globalMuted;

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const startTicking = (startedAt: number) => {
    if (intervalId) return;
    intervalId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const duration = warmupMs();
      const ratio = Math.min(1, elapsed / duration);
      setProgress(ratio);
      setRemaining(Math.max(0, Math.ceil((duration - elapsed) / 1000)));

      if (ratio >= 1) {
        setPhase("green");
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
      } else if (ratio >= 0.6) {
        setPhase("yellow");
      } else {
        setPhase("red");
      }
    }, 250);
  };

  createEffect(() => {
    // Warmup disabled → skip straight to green ON
    if (warmupMs() <= 0) {
      setPhase("green");
      setProgress(1);
      return;
    }

    const outputAt = props.firstOutputAt;
    if (!outputAt) {
      setPhase("waiting");
      return;
    }

    if (Date.now() - outputAt >= warmupMs()) {
      setPhase("green");
      setProgress(1);
      return;
    }

    setPhase("red");
    startTicking(outputAt);
  });

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId);
  });

  const phaseColor = () => {
    switch (phase()) {
      case "red": return "var(--danger)";
      case "yellow": return "var(--warning)";
      case "green": return "var(--success)";
      default: return "var(--text-secondary)";
    }
  };

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
      <Show when={phase() !== "waiting"} fallback={
        <span class="shrink-0 text-[var(--text-secondary)] opacity-20" title="Waiting for output...">
          <BellIcon />
        </span>
      }>
        <div
          class="shrink-0 flex items-center gap-1 px-1.5 rounded-full overflow-hidden relative cursor-pointer"
          classList={{ "warmup-green-pulse": phase() === "green" && progress() === 1 }}
          style={{ height: "16px", "min-width": "36px" }}
          title={phase() === "green"
            ? "Notifications active — click to mute"
            : `Notifications activate in ${remaining()}s`}
          onClick={(e) => { e.stopPropagation(); props.onMuteToggle(); }}
        >
          {/* Background track */}
          <div
            class="absolute inset-0 rounded-full transition-colors duration-500"
            style={{
              background: `color-mix(in srgb, ${phaseColor()} 12%, transparent)`,
            }}
          />
          {/* Progress fill */}
          <div
            class="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress() * 100}%`,
              background: `color-mix(in srgb, ${phaseColor()} 25%, transparent)`,
            }}
          />
          {/* Ringing bell */}
          <PillBell />
          {/* Countdown / ON text */}
          <span
            class="relative text-[9px] font-mono z-10 transition-colors duration-500 leading-none"
            style={{ color: phaseColor() }}
          >
            {phase() === "green" ? "ON" : `${remaining()}s`}
          </span>
        </div>
      </Show>
    </Show>
  );
}
