// Synthesised sound with Web Audio. No audio files.
// Browsers only allow audio after a tap, so call sound.unlock() from a tap handler.

export function createSound({ muted = false } = {}) {
  let ctx = null;
  let isMuted = muted;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  // One short tone with a quick fade in and out.
  function tone({ freq, start = 0, dur = 0.12, type = 'sine', gain = 0.12, slideTo = null }) {
    const c = ensure();
    if (!c || isMuted) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const SOUNDS = {
    tap: () => tone({ freq: 520, dur: 0.05, type: 'triangle', gain: 0.06 }),
    move: () => tone({ freq: 220, slideTo: 150, dur: 0.1, type: 'triangle', gain: 0.16 }),
    capture: () => {
      tone({ freq: 200, slideTo: 90, dur: 0.14, type: 'sawtooth', gain: 0.11 });
      tone({ freq: 330, start: 0.05, dur: 0.1, type: 'triangle', gain: 0.1 });
    },
    check: () => {
      tone({ freq: 660, dur: 0.1, type: 'square', gain: 0.06 });
      tone({ freq: 880, start: 0.12, dur: 0.14, type: 'square', gain: 0.06 });
    },
    error: () => tone({ freq: 140, dur: 0.12, type: 'square', gain: 0.05 }),
    hint: () => tone({ freq: 740, dur: 0.14, type: 'sine', gain: 0.08 }),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, start: i * 0.11, dur: 0.2, type: 'triangle', gain: 0.12 })),
    lose: () => [392, 330, 262].forEach((f, i) => tone({ freq: f, start: i * 0.14, dur: 0.22, type: 'triangle', gain: 0.1 })),
    draw: () => [440, 440].forEach((f, i) => tone({ freq: f, start: i * 0.16, dur: 0.16, type: 'sine', gain: 0.09 })),
    // Wooden tick for a dropped seed. `step` raises the pitch a little so counting is audible.
    seed: (step = 0) => tone({ freq: 360 + Math.min(step, 12) * 22, slideTo: 300 + Math.min(step, 12) * 18, dur: 0.07, type: 'triangle', gain: 0.1 }),
    pick: () => tone({ freq: 260, slideTo: 340, dur: 0.09, type: 'sine', gain: 0.09 }),
    success: () => [660, 880].forEach((f, i) => tone({ freq: f, start: i * 0.09, dur: 0.14, type: 'triangle', gain: 0.1 })),
  };

  return {
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },
    setMuted(value) {
      isMuted = Boolean(value);
    },
    get muted() {
      return isMuted;
    },
    play(name, arg) {
      const fn = SOUNDS[name];
      if (fn) fn(arg);
    },
  };
}
