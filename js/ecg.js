// Scrolling cardiogram strip. Baseline hum with QRS-like spikes pushed in
// by game events. Flatlines on game over.

export class ECG {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.samples = [];
    this.spike = 0;      // pending spike energy
    this.flat = false;
    this.x = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.samples = new Array(Math.ceil(this.w)).fill(0);
  }

  beat(strength = 1) { this.spike = Math.max(this.spike, strength); }
  flatline() { this.flat = true; }
  revive() { this.flat = false; }

  update(dt) {
    const speed = Math.max(1, Math.round(140 * dt)); // px per frame
    for (let i = 0; i < speed; i++) {
      let v;
      if (this.flat) {
        v = 0;
      } else if (this.spike > 0.05) {
        // compressed QRS: down, sharp up, down, recover
        const ph = this._spikePhase = (this._spikePhase || 0) + 1;
        const seq = [-0.15, 0.2, 1.0, -0.45, -0.1, 0.05, 0];
        v = (seq[ph - 1] ?? 0) * this.spike;
        if (ph >= seq.length) { this.spike = 0; this._spikePhase = 0; }
      } else {
        v = (Math.random() - 0.5) * 0.06;
      }
      this.samples.push(v);
      this.samples.shift();
    }

    const ctx = this.ctx, w = this.w, h = this.h, mid = h * 0.55;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = this.flat ? '#ff3b5c' : '#4ff2e4';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = mid - this.samples[x] * h * 0.42;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
