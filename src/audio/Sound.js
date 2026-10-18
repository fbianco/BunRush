// ---------------------------------------------------------------------------
// Sound: every effect and the music are synthesised live with the Web Audio
// API (oscillators + noise), like the sound chip of an 8-bit computer.
// No audio files needed. The tune is original.
// ---------------------------------------------------------------------------

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note -> Hz

// 16 steps per bar, 4 bars: I - vi - IV - V in C major
const BASS = [36, 48, 43, 48, 33, 45, 40, 45, 41, 53, 48, 53, 43, 55, 50, 55];
const LEAD = [
  72, 0, 76, 79, 0, 76, 74, 72, 69, 0, 72, 76, 0, 74, 72, 69,
  65, 0, 69, 72, 0, 77, 76, 74, 67, 0, 71, 74, 79, 77, 76, 74,
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.8;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.22;
      this.music.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      console.warn('No Web Audio', e);
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  tone(freq, dur, { type = 'square', vol = 0.25, slide = 0, delay = 0, out = this.sfx } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.3, freq = 1800, delay = 0, out = this.sfx } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'step': this.tone(880 + Math.random() * 120, 0.05, { vol: 0.08, type: 'triangle' }); break;
      case 'drop': this.tone(520, 0.25, { slide: -380, vol: 0.18 }); break;
      case 'land': this.noise(0.12, { freq: 400, vol: 0.4 }); this.tone(110, 0.12, { type: 'triangle', vol: 0.3 }); break;
      case 'plate':
        [784, 988, 1175].forEach((f, i) => this.tone(f, 0.12, { delay: i * 0.06, vol: 0.15, type: 'triangle' }));
        break;
      case 'burger':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { delay: 0.2 + i * 0.08, vol: 0.18 }));
        break;
      case 'pepper': this.noise(0.35, { freq: 3500, vol: 0.35 }); break;
      case 'empty': this.tone(160, 0.15, { vol: 0.15 }); break;
      case 'stun': this.tone(1200, 0.3, { slide: -700, type: 'sine', vol: 0.18 }); break;
      case 'squash': this.tone(300, 0.2, { slide: -250, type: 'sawtooth', vol: 0.2 }); this.noise(0.15, { freq: 900 }); break;
      case 'die':
        [660, 620, 580, 540, 500, 440, 380, 300].forEach((f, i) => this.tone(f, 0.13, { delay: i * 0.12, vol: 0.2 }));
        break;
      case 'clear':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, { delay: i * 0.11, vol: 0.2 }));
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, { delay: i * 0.3, vol: 0.2, type: 'triangle' }));
        break;
      case 'ready': [392, 523].forEach((f, i) => this.tone(f, 0.12, { delay: i * 0.12, vol: 0.15 })); break;
      case 'bonus': this.tone(1568, 0.1, { vol: 0.12 }); this.tone(2093, 0.15, { delay: 0.08, vol: 0.12 }); break;
      case 'pickup': [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.08, { delay: i * 0.05, vol: 0.14 })); break;
      case 'start': [262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.1, { delay: i * 0.07, vol: 0.18 })); break;
      default: break;
    }
  }

  // ---- music: a tiny look-ahead sequencer -----------------------------------
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  stopMusic() {
    this.musicOn = false;
    clearInterval(this.timer);
  }

  schedule() {
    const stepDur = 60 / 150 / 2; // eighth notes at 150 bpm
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const delay = this.nextTime - this.ctx.currentTime;
      const b = BASS[this.step % BASS.length];
      this.tone(NOTE(b), stepDur * 0.9, { type: 'triangle', vol: 0.5, delay, out: this.music });
      const l = LEAD[this.step % LEAD.length];
      if (l) this.tone(NOTE(l), stepDur * 0.8, { type: 'square', vol: 0.16, delay, out: this.music });
      if (this.step % 4 === 2) this.noise(0.04, { freq: 7000, vol: 0.08, delay, out: this.music });
      this.step++;
      this.nextTime += stepDur;
    }
  }
}
