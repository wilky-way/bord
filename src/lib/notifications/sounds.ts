let audioCtx: AudioContext | null = null;
let resumePromise: Promise<void> | null = null;
let unlockInstalled = false;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContext();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function resumeAudioContext(ctx: AudioContext): Promise<void> {
  if (ctx.state === "running") return Promise.resolve();
  if (!resumePromise) {
    resumePromise = ctx
      .resume()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        resumePromise = null;
      });
  }
  return resumePromise;
}

function installUnlockHandlers() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;

  const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
  const unlock = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    void resumeAudioContext(ctx).finally(() => {
      if (ctx.state === "running") {
        for (const event of events) {
          window.removeEventListener(event, unlock, true);
        }
      }
    });
  };

  for (const event of events) {
    window.addEventListener(event, unlock, { capture: true, passive: true });
  }
}

installUnlockHandlers();

type SoundCategory = "chime" | "error";

export function playSound(category: SoundCategory) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const playNow = () => {
    if (category === "chime") {
      playChime(ctx);
    } else if (category === "error") {
      playError(ctx);
    }
  };

  if (ctx.state === "running") {
    playNow();
    return;
  }

  void resumeAudioContext(ctx).then(() => {
    if (ctx.state === "running") {
      playNow();
    }
  });
}

function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;

  // Two-note ascending chime (C6 → E6)
  const notes = [1047, 1319]; // C6, E6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
    osc.start(start);
    osc.stop(start + 0.25);
  });
}

function playError(ctx: AudioContext) {
  const now = ctx.currentTime;

  // Short descending buzz (A4 → F4)
  const notes = [440, 349];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = now + i * 0.1;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.1, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    osc.start(start);
    osc.stop(start + 0.18);
  });
}
