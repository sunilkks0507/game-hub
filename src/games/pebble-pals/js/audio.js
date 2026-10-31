/**
 * Pebble Pals: Audio Synthesizer
 * Built-in Web Audio API Zero-Dependency Sound Engine
 */

class SoundSynthesizer {
  // Hub key first; the old standalone key is read once so players keep their choice.
  static loadMuted() {
    try {
      const saved = localStorage.getItem('hub:pebble-pals:muted:v1');
      if (saved !== null) return JSON.parse(saved) === true;
      return localStorage.getItem('pebble_pals_muted') === 'true';
    } catch (e) {
      return false;
    }
  }

  constructor() {
    this.ctx = null;
    this.muted = SoundSynthesizer.loadMuted();
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  ensureContext() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.ensureContext();
    this.muted = !this.muted;
    try {
      localStorage.setItem('hub:pebble-pals:muted:v1', JSON.stringify(this.muted));
    } catch (e) { /* storage blocked */ }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime);
    }
    return this.muted;
  }

  // 1. Wooden Pop on Pebble Placement
  playPop() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);

    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.1);

    // Subtle click impact
    const snap = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snap.type = 'sine';
    snap.frequency.setValueAtTime(880, t);
    snap.frequency.exponentialRampToValueAtTime(220, t + 0.03);
    snapGain.gain.setValueAtTime(0.4, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    snap.connect(snapGain);
    snapGain.connect(this.masterGain);
    snap.start(t);
    snap.stop(t + 0.04);
  }

  // 2. Bubbly Splash Chime on Capture
  playCapture() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const pitches = [392, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
    
    pitches.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + idx * 0.045;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, startTime + 0.12);

      gain.gain.setValueAtTime(0.5, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  // 3. Playful Cartoon Boing (Suicide / Illegal Move)
  playBoing() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Classic boing: drop then wobble
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.15);
    osc.frequency.linearRampToValueAtTime(220, t + 0.28);
    osc.frequency.linearRampToValueAtTime(120, t + 0.42);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.46);
  }

  // 4. Danger Alert Chime (Atari Warning)
  playAtari() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [659.25, 830.61]; // E5, G#5 urgent marimba

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + i * 0.1;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, st);

      // Low pass to soften square wave
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, st);

      gain.gain.setValueAtTime(0.35, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(st);
      osc.stop(st + 0.2);
    });
  }

  // 5. Magical Shimmer on Enclosed Territory
  playEnclosed() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6

    arpeggio.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);

      gain.gain.setValueAtTime(0.4, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(st);
      osc.stop(st + 0.38);
    });
  }

  // 6. Grand Victory Fanfare
  playVictory() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Uplifting fanfare: C4 -> G4 -> C5 -> E5 -> G5 (held)
    const melody = [
      { f: 523.25, d: 0.15, offset: 0.0 },
      { f: 659.25, d: 0.15, offset: 0.15 },
      { f: 783.99, d: 0.15, offset: 0.30 },
      { f: 1046.5, d: 0.45, offset: 0.45 },
      { f: 783.99, d: 0.12, offset: 0.95 },
      { f: 1046.5, d: 0.8, offset: 1.1 }
    ];

    melody.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + note.offset;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, st);

      gain.gain.setValueAtTime(0.55, st);
      gain.gain.setValueAtTime(0.55, st + note.d * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, st + note.d);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(st);
      osc.stop(st + note.d + 0.05);
    });
  }

  // 7. General UI Tap Click
  playClick() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.03);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.04);
  }

  // 8. Trophy Badge Unlock Harp
  playBadge() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + idx * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);

      gain.gain.setValueAtTime(0.5, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(st);
      osc.stop(st + 0.45);
    });
  }

  // 9. Heart Breathing Space Indicator Chime
  playHeart() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  // 10. Book Page Turn / Open Sound
  playPageFlip() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.08);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.13);
  }
}

// Global Sound Instance
window.soundFx = new SoundSynthesizer();
