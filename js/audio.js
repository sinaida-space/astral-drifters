// Procedural drone: three detuned oscillators through a slowly breathing
// lowpass into a feedback delay. Tension (ball speed) opens the filter.
// All SFX are synthesized — the repo ships no audio files.

export class Drone {
  constructor() {
    this.ctx = null;
    this.tension = 0;
  }

  // Call from a user gesture.
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 4);

    // feedback delay as space
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass'; fbFilter.frequency.value = 1600;
    delay.connect(fb); fb.connect(fbFilter); fbFilter.connect(delay);
    delay.connect(this.master);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 220;
    this.filter.Q.value = 2.5;
    this.filter.connect(this.master);
    this.filter.connect(delay);

    // breathing LFO on the filter
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain); lfoGain.connect(this.filter.frequency);
    lfo.start();

    const droneBus = ctx.createGain();
    droneBus.gain.value = 0.24;
    droneBus.connect(this.filter);

    for (const [type, freq, det, g] of [
      ['sine', 55, 0, 1.0],
      ['sawtooth', 110, 7, 0.35],
      ['sawtooth', 110.7, -5, 0.35],
      ['sine', 164.8, 3, 0.5],
    ]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = freq; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og); og.connect(droneBus);
      o.start();
    }

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.7;
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(delay);
  }

  setTension(t) { // 0..1
    if (!this.ctx) return;
    this.tension = t;
    const f = 220 + t * 1400;
    this.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.5);
  }

  _ping(freq, dur, type = 'sine', gain = 0.5, slideTo = null) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  paddle() { this._ping(660, 0.25, 'sine', 0.5); this._ping(662, 0.3, 'sine', 0.25); }
  wall() { this._ping(220 + Math.random() * 60, 0.12, 'triangle', 0.22); }
  block(combo) { this._ping(880 * Math.pow(1.0595, Math.min(combo, 12)), 0.35, 'square', 0.28); }
  miss() { this._ping(440, 1.4, 'sawtooth', 0.4, 55); }
  wave() { this._ping(330, 1.2, 'sine', 0.3); this._ping(495, 1.6, 'sine', 0.22); this._ping(660, 2.0, 'sine', 0.15); }
  over() { this._ping(220, 2.5, 'sawtooth', 0.4, 27.5); }
}
