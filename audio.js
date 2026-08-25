// audio.js — Web Audio replacement for the Python game's audio engine.
//
// Every .wav in the desktop build was generated procedurally at first launch,
// so rather than shipping ~20 sound files we run the identical sample-loop
// maths into an AudioBuffer at startup. Only the music is a real download.

const SR = 44100;
const AMP = 32767;

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.volumeTier = 'MID';
    this.volume = 0.6;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.specialSounds = true;
    this.musicEl = null;
    this.currentTrack = null;
    this.ready = false;
  }

  // iOS will not let an AudioContext start outside a user gesture.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._buildAll();
    this.ready = true;
  }

  // --- generators (ports of the Python ones, same maths) ------------------
  _buf(samples) {
    const b = this.ctx.createBuffer(1, samples.length, SR);
    b.getChannelData(0).set(samples);
    return b;
  }

  _sweep(startF, endF, duration = 0.10, amplitude = 2500, waveform = 'square') {
    const n = Math.floor(SR * duration), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const freq = startF * Math.pow(endF / startF, t);
      const phase = 2 * Math.PI * freq * (i / SR);
      const v = waveform === 'sine'
        ? amplitude * Math.sin(phase)
        : (Math.sin(phase) > 0 ? amplitude : -amplitude);
      out[i] = v / AMP;
    }
    return this._buf(out);
  }

  _bling(noteFreqs, noteDuration = 0.06) {
    const per = Math.floor(SR * noteDuration);
    const out = new Float32Array(per * noteFreqs.length);
    let k = 0;
    for (const freq of noteFreqs) {
      for (let i = 0; i < per; i++) {
        const fade = 1 - i / per;
        const v = 2500 * Math.sin(2 * Math.PI * freq * (i / SR)) * fade;
        out[k++] = v / AMP;
      }
    }
    return this._buf(out);
  }

  _electricSweep(startF, endF, duration = 0.08, waveform = 'saw', fmDepth = 8, fmRate = 60, amplitude = 2800) {
    const n = Math.floor(SR * duration), out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const base = startF * Math.pow(endF / startF, t);
      const mod = 1 + (fmDepth / 100) * Math.sin(2 * Math.PI * fmRate * (i / SR));
      phase += (base * mod) / SR;
      const frac = phase % 1;
      let raw;
      if (waveform === 'saw') raw = amplitude * (2 * frac - 1);
      else if (waveform === 'sine') raw = amplitude * Math.sin(2 * Math.PI * frac);
      else raw = frac < 0.5 ? amplitude : -amplitude;
      out[i] = (raw * (1 - t * 0.3)) / AMP;
    }
    return this._buf(out);
  }

  _electricSeq(noteFreqs, noteDuration = 0.05, waveform = 'saw', fmDepth = 8, fmRate = 70) {
    const per = Math.floor(SR * noteDuration);
    const out = new Float32Array(per * noteFreqs.length);
    const amplitude = 2800;
    let k = 0;
    for (const freq of noteFreqs) {
      let phase = 0;
      for (let i = 0; i < per; i++) {
        const mod = 1 + (fmDepth / 100) * Math.sin(2 * Math.PI * fmRate * (i / SR));
        phase += (freq * mod) / SR;
        const frac = phase % 1;
        const raw = waveform === 'saw'
          ? amplitude * (2 * frac - 1)
          : (frac < 0.5 ? amplitude : -amplitude);
        out[k++] = (raw * (1 - i / per)) / AMP;
      }
    }
    return this._buf(out);
  }

  // --- the catalogue, mirroring the Python module-level constants ---------
  _buildAll() {
    const B = this.buffers;
    // electric set (Special Sounds ON)
    B.click        = this._electricSeq([523.25, 659.25, 880.0], 0.035, 'saw', 8, 70);
    B.esc          = this._electricSeq([880.0, 659.25, 440.0], 0.04, 'square', 6, 50);
    B.coin         = this._electricSeq([1318.5, 1760.0, 2217.5], 0.045, 'saw', 10, 90);
    B.fanfare      = this._electricSeq([1046.5, 1318.5, 1568.0, 2093.0, 2637.0], 0.07, 'saw', 8, 55);
    B.lose         = this._electricSeq([415.3, 349.2, 277.2, 220.0, 174.6], 0.09, 'square', 14, 30);
    B.menu_open    = this._electricSeq([110.0, 233.08, 349.23, 523.25, 698.46], 0.035, 'saw', 20, 55);
    B.pew          = this._electricSweep(1400, 250, 0.06, 'saw', 12, 100);
    B.block_hit    = this._electricSweep(650, 120, 0.3, 'square', 18, 25);
    B.menu_move    = this._electricSweep(600, 900, 0.025, 'saw', 6, 120);
    B.eat          = this._electricSweep(900, 180, 0.06, 'square', 18, 85, 3000);
    B.move_bup     = this._electricSweep(240, 190, 0.018, 'sine', 1, 25, 400);
    B.flap         = this._electricSweep(300, 700, 0.05, 'saw', 10, 60, 2600);
    // classic set (Special Sounds OFF)
    B.click_c      = this._sweep(220, 880, 0.08);
    B.esc_c        = this._sweep(880, 220, 0.10);
    B.coin_c       = this._bling([1318.5, 1975.5], 0.06);
    B.fanfare_c    = this._bling([1046.5, 1318.5, 1568.0, 2093.0], 0.08);
    B.lose_c       = this._bling([311.0, 293.7, 261.6, 233.1], 0.16);
    B.menu_open_c  = this._bling([110.0, 233.08, 349.23, 523.25, 698.46], 0.035);
    B.pew_c        = this._sweep(1200, 300, 0.05);
    B.block_hit_c  = this._sweep(600, 140, 0.25);
    B.menu_move_c  = this._sweep(500, 700, 0.03);
    B.eat_c        = this._sweep(900, 180, 0.06, 2500);
    B.move_bup_c   = this._sweep(240, 190, 0.018, 350, 'sine');
    B.flap_c       = this._sweep(300, 700, 0.05, 2400);
  }

  // --- playback -----------------------------------------------------------
  play(name) {
    if (!this.ready || !this.sfxEnabled || this.volume === 0) return;
    const key = this.specialSounds ? name : (this.buffers[name + '_c'] ? name + '_c' : name);
    const buf = this.buffers[key];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = this.volume;
    src.buffer = buf;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  playMusic(path) {
    if (this.currentTrack === path && this.musicEl && !this.musicEl.paused) return;
    this.currentTrack = path;
    if (!this.musicEnabled || this.volume === 0) return;
    if (this.musicEl) { this.musicEl.pause(); this.musicEl = null; }
    const el = new Audio(path);
    el.loop = true;
    el.volume = this.volume;
    el.play().catch(() => {});   // blocked until first gesture; harmless
    this.musicEl = el;
  }

  stopMusic() {
    if (this.musicEl) { this.musicEl.pause(); this.musicEl = null; }
    this.currentTrack = null;
  }

  setVolumeTier(tier) {
    const tiers = { OFF: 0.0, LOW: 0.3, MID: 0.6, LOUD: 1.0 };
    this.volumeTier = tier;
    this.volume = tiers[tier] ?? 0.6;
    if (this.musicEl) this.musicEl.volume = this.volume;
    if (this.volume === 0) this.stopMusic();
    else if (this.currentTrack && !this.musicEl) this.playMusic(this.currentTrack);
  }
}
