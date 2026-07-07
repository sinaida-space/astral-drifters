// Gyro → virtual eye offset. The phone tilts; we pretend the viewer's eye
// moved in front of a fixed window. Calibrated against the pose at game start.

const SIGN_X = 1;   // flip if tilting right should look left
const SIGN_Y = -1;  // flip if tilting away should look up

const RANGE_DEG = 42;   // tilt (deg) that reaches full eye/paddle offset

export class Orientation {
  constructor() {
    this.raw = { beta: null, gamma: null };
    this.ref = { beta: 0, gamma: 0 };
    // normalized eye offset, -1..1, smoothed
    this.x = 0;
    this.y = 0;
    this._tx = 0;
    this._ty = 0;
    this.active = false;
    this.debugMouse = false;
    this._onEvent = (e) => {
      if (e.beta === null || e.gamma === null) return;
      this.raw.beta = e.beta;
      this.raw.gamma = e.gamma;
      if (!this.active) { this.calibrate(); this.active = true; }
      const dg = this._wrap(e.gamma - this.ref.gamma);
      const db = this._wrap(e.beta - this.ref.beta);
      this._tx = clamp(SIGN_X * dg / RANGE_DEG, -1, 1);
      this._ty = clamp(SIGN_Y * db / RANGE_DEG, -1, 1);
    };
  }

  _wrap(d) {
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  // Must be called from a user gesture (iOS).
  async request() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return false;
      } catch {
        return false;
      }
    }
    window.addEventListener('deviceorientation', this._onEvent);
    return true;
  }

  enableMouseDebug() {
    this.debugMouse = true;
    this.active = true;
    window.addEventListener('pointermove', (e) => {
      this._tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      this._ty = clamp(-((e.clientY / window.innerHeight) * 2 - 1), -1, 1);
    });
  }

  calibrate() {
    if (this.raw.beta !== null) {
      this.ref.beta = this.raw.beta;
      this.ref.gamma = this.raw.gamma;
    }
  }

  update(dt) {
    const k = 1 - Math.pow(0.0001, dt); // smooth toward target
    this.x += (this._tx - this.x) * k;
    this.y += (this._ty - this.y) * k;
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
