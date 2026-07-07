// Off-axis anamorphic scene. The screen is a window at z=0 into a tunnel
// running toward -z. The camera sits at the virtual eye position and its
// frustum is skewed so the window rect always maps exactly to the screen —
// the Kooima generalized-perspective trick for an axis-aligned screen.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const TEAL = 0x4ff2e4;
export const TEAL_DIM = 0x14554f;
export const ALERT = 0xff3b5c;

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.eyeDist = 4.0;          // virtual eye distance from the window
    this.eyeRange = { x: 2.0, y: 2.4 };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010606, 0.055);

    this.camera = new THREE.PerspectiveCamera();
    this.camera.matrixAutoUpdate = false;

    this._sizeWindow();
    this._buildTunnel();
    this._buildPost();

    this.quality = 2; // 2 full fx, 1 no afterimage, 0 minimal
    this._fpsAcc = 0; this._fpsN = 0; this._fpsT = 0;

    window.addEventListener('resize', () => this.resize());
  }

  // World-space size of the window rect, matched to screen aspect.
  _sizeWindow() {
    const aspect = window.innerWidth / window.innerHeight;
    this.winW = aspect >= 1 ? 4.4 : 3.2;
    this.winH = this.winW / aspect;
    this.tunnelLen = 26;
  }

  _grid(w, h, nx, ny) {
    const pts = [];
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx;
      pts.push(x, -h / 2, 0, x, h / 2, 0);
    }
    for (let j = 0; j <= ny; j++) {
      const y = -h / 2 + (h * j) / ny;
      pts.push(-w / 2, y, 0, w / 2, y, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }

  _buildTunnel() {
    if (this.tunnel) this.scene.remove(this.tunnel);
    const W = this.winW, H = this.winH, L = this.tunnelLen;
    const mat = new THREE.LineBasicMaterial({ color: TEAL_DIM, transparent: true, opacity: 0.9 });
    const matBright = new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.5 });
    const t = new THREE.Group();

    const nz = 26;
    // side walls
    for (const sx of [-1, 1]) {
      const wall = new THREE.LineSegments(this._grid(L, H, nz, 6), mat);
      wall.rotation.y = Math.PI / 2;
      wall.position.set(sx * W / 2, 0, -L / 2);
      t.add(wall);
    }
    // floor / ceiling
    for (const sy of [-1, 1]) {
      const wall = new THREE.LineSegments(this._grid(W, L, 6, nz), mat);
      wall.rotation.x = Math.PI / 2;
      wall.position.set(0, sy * H / 2, -L / 2);
      t.add(wall);
    }
    // back wall
    const back = new THREE.LineSegments(this._grid(W, H, 6, 10), matBright);
    back.position.z = -L;
    t.add(back);

    // window frame — the bright edge where tunnel meets screen
    const frame = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute([-W / 2, -H / 2, 0, W / 2, -H / 2, 0, W / 2, H / 2, 0, -W / 2, H / 2, 0], 3)),
      new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.9 }));
    t.add(frame);

    // depth rings every few units — anchors for the parallax read
    for (let z = -4; z > -this.tunnelLen; z -= 4) {
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position',
        new THREE.Float32BufferAttribute([-W / 2, -H / 2, 0, W / 2, -H / 2, 0, W / 2, H / 2, 0, -W / 2, H / 2, 0], 3)),
        new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.22 }));
      ring.position.z = z;
      t.add(ring);
    }

    // drifting dust — cheap depth cue
    const n = 220, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * W;
      pos[i * 3 + 1] = (Math.random() - 0.5) * H;
      pos[i * 3 + 2] = -Math.random() * L;
    }
    this.dust = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color: TEAL, size: 0.035, transparent: true, opacity: 0.55 }));
    t.add(this.dust);

    this.tunnel = t;
    this.scene.add(t);
  }

  _buildPost() {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size.multiplyScalar(0.5), 0.95, 0.55, 0.32);
    this.composer.addPass(this.bloom);
    this.afterimage = new AfterimagePass(0.8);
    this.composer.addPass(this.afterimage);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this._sizeWindow();
    this._buildTunnel();
  }

  // eye: normalized offsets -1..1 from Orientation
  updateCamera(exN, eyN) {
    const ex = exN * this.eyeRange.x;
    const ey = eyN * this.eyeRange.y;
    const d = this.eyeDist;
    const near = 0.25, far = 80;
    const s = near / d;
    this.camera.projectionMatrix.makePerspective(
      (-this.winW / 2 - ex) * s, (this.winW / 2 - ex) * s,
      (this.winH / 2 - ey) * s, (-this.winH / 2 - ey) * s,
      near, far);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.camera.matrix.makeTranslation(ex, ey, d);
    this.camera.matrixWorld.copy(this.camera.matrix);
    this.camera.matrixWorldInverse.copy(this.camera.matrix).invert();
    this.eye = { x: ex, y: ey, d };
  }

  // Where the eye→screen-center ray crosses plane z, world coords.
  centerRayAt(z) {
    const t = (this.eye.d - z) / this.eye.d;
    return { x: this.eye.x * (1 - t), y: this.eye.y * (1 - t) };
  }

  render(dt, elapsed) {
    // slow dust drift toward the window
    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let z = p.getZ(i) + dt * 0.5;
      if (z > 0) z = -this.tunnelLen;
      p.setZ(i, z);
    }
    p.needsUpdate = true;

    this._autoQuality(dt);
    this.composer.render();
  }

  _autoQuality(dt) {
    this._fpsAcc += dt; this._fpsN++;
    this._fpsT += dt;
    if (this._fpsT > 3) {
      const fps = this._fpsN / this._fpsAcc;
      if (fps < 40 && this.quality === 2) {
        this.quality = 1;
        this.afterimage.enabled = false;
      } else if (fps < 32 && this.quality === 1) {
        this.quality = 0;
        this.bloom.strength = 0.45;
        this.renderer.setPixelRatio(1);
        this.composer.setSize(window.innerWidth, window.innerHeight);
      }
      this._fpsAcc = 0; this._fpsN = 0; this._fpsT = 0;
    }
  }
}
