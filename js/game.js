// Ball, paddle, blocks. The paddle is a physical object riding the tilt
// directly — the phone IS the paddle, moved 1:1 through the room, not an
// optical artifact of the camera's off-axis ray (that math inverts and
// shrinks range, which read as "glued to the edges").

import * as THREE from 'three';
import { TEAL, ALERT } from './scene.js';

const BALL_R = 0.13;
const PADDLE_W = 1.1, PADDLE_H = 0.8;
const PADDLE_Z = -1.4;       // near the window — it's in your hand
const PADDLE_REACH = 0.92;   // fraction of half-window reachable at full tilt
const PADDLE_MARGIN = 0.06;  // forgiveness on corner catches

export class Game {
  constructor(stage, events) {
    this.stage = stage;
    this.events = events; // { onScore, onMiss, onHit, onBlock, onWave, onGameOver }
    this.group = new THREE.Group();
    stage.scene.add(this.group);

    this._buildPaddle();
    this._buildBall();
    this.blocks = [];

    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.wave = 0;
    this.combo = 0;
    this.speed = 6.0;
    this.state = 'serve'; // serve | play | dead | over
    this._deadT = 0;
    this._clearBlocks();
    this._spawnWave();
    this._resetBall();
  }

  _buildPaddle() {
    const g = new THREE.Group();
    const w = PADDLE_W, h = PADDLE_H;
    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
        [-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0], 3)),
      new THREE.LineBasicMaterial({ color: TEAL }));
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
    g.add(fill, border);
    g.position.z = PADDLE_Z;
    this.paddle = g;
    this.paddleFill = fill;
    this.group.add(g);
  }

  _buildBall() {
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xd8fffb }));
    this.vel = new THREE.Vector3();
    this.group.add(this.ball);
  }

  _resetBall() {
    this.state = 'serve';
    this.ball.position.set(this.paddle.position.x, this.paddle.position.y, PADDLE_Z - 0.4);
    this.vel.set(0, 0, 0);
  }

  serve() {
    if (this.state !== 'serve') return false;
    const a = (Math.random() - 0.5) * 0.8;
    this.vel.set(Math.sin(a) * 0.35, (Math.random() - 0.5) * 0.3, -1).normalize().multiplyScalar(this.speed);
    this.state = 'play';
    return true;
  }

  _clearBlocks() {
    for (const b of this.blocks) this.group.remove(b.mesh);
    this.blocks = [];
  }

  _spawnWave() {
    this.wave++;
    const W = this.stage.winW, H = this.stage.winH, L = this.stage.tunnelLen;
    const slices = Math.min(2 + this.wave, 5);
    const bw = W / 4.6, bh = H / 9, bd = 0.55;
    const geo = new THREE.BoxGeometry(bw, bh, bd);
    const edges = new THREE.EdgesGeometry(geo);
    for (let s = 0; s < slices; s++) {
      const z = -6 - s * (L - 10) / Math.max(slices - 1, 1);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (Math.random() < 0.2) continue;
          const mesh = new THREE.Group();
          const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: 0x0b2e2a, transparent: true, opacity: 0.85 }));
          const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: TEAL }));
          mesh.add(body, line);
          mesh.position.set(i * bw * 1.45, j * bh * 2.2, z);
          mesh.userData.phase = Math.random() * Math.PI * 2;
          mesh.userData.home = mesh.position.clone();
          this.group.add(mesh);
          this.blocks.push({ mesh, hw: bw / 2, hh: bh / 2, hd: bd / 2, dying: 0 });
        }
      }
    }
    this.events.onWave?.(this.wave);
  }

  update(dt, elapsed, orientX = 0, orientY = 0) {
    // paddle moves 1:1 with tilt — it's the object in your hand, full reach to the corners
    const W = this.stage.winW, H = this.stage.winH;
    this.paddle.position.x = clamp(orientX * PADDLE_REACH * (W / 2), -W / 2 + PADDLE_W / 2, W / 2 - PADDLE_W / 2);
    this.paddle.position.y = clamp(orientY * PADDLE_REACH * (H / 2), -H / 2 + PADDLE_H / 2, H / 2 - PADDLE_H / 2);

    // blocks drift — they are "flying", not parked
    for (const b of this.blocks) {
      const m = b.mesh, ph = m.userData.phase;
      m.position.x = m.userData.home.x + Math.sin(elapsed * 0.6 + ph) * 0.12;
      m.position.y = m.userData.home.y + Math.cos(elapsed * 0.45 + ph) * 0.12;
      m.rotation.z = Math.sin(elapsed * 0.3 + ph) * 0.15;
      if (b.dying > 0) {
        b.dying -= dt * 4;
        m.scale.setScalar(Math.max(b.dying, 0.001));
        if (b.dying <= 0) {
          this.group.remove(m);
          m.children.forEach(c => c.material.dispose());
        }
      }
    }
    this.blocks = this.blocks.filter(b => b.dying === 0 || b.dying > 0 && b.mesh.parent);

    if (this.state === 'serve') {
      this.ball.position.set(this.paddle.position.x, this.paddle.position.y, PADDLE_Z - 0.4);
      return;
    }
    if (this.state === 'dead') {
      this._deadT -= dt;
      if (this._deadT <= 0) this._resetBall();
      return;
    }
    if (this.state !== 'play') return;

    // slow global acceleration
    this.speed += dt * 0.03;
    this.vel.setLength(this.speed);

    const prevZ = this.ball.position.z;
    this.ball.position.addScaledVector(this.vel, dt);
    const p = this.ball.position;
    const L = this.stage.tunnelLen;

    // tunnel walls
    if (p.x < -W / 2 + BALL_R) { p.x = -W / 2 + BALL_R; this.vel.x = Math.abs(this.vel.x); this.events.onHit?.('wall'); }
    if (p.x > W / 2 - BALL_R) { p.x = W / 2 - BALL_R; this.vel.x = -Math.abs(this.vel.x); this.events.onHit?.('wall'); }
    if (p.y < -H / 2 + BALL_R) { p.y = -H / 2 + BALL_R; this.vel.y = Math.abs(this.vel.y); this.events.onHit?.('wall'); }
    if (p.y > H / 2 - BALL_R) { p.y = H / 2 - BALL_R; this.vel.y = -Math.abs(this.vel.y); this.events.onHit?.('wall'); }
    if (p.z < -L + BALL_R) { p.z = -L + BALL_R; this.vel.z = Math.abs(this.vel.z); this.events.onHit?.('back'); }

    // paddle plane
    if (prevZ <= PADDLE_Z && p.z > PADDLE_Z && this.vel.z > 0) {
      const dx = p.x - this.paddle.position.x, dy = p.y - this.paddle.position.y;
      if (Math.abs(dx) < PADDLE_W / 2 + BALL_R + PADDLE_MARGIN && Math.abs(dy) < PADDLE_H / 2 + BALL_R + PADDLE_MARGIN) {
        p.z = PADDLE_Z;
        this.vel.z = -Math.abs(this.vel.z);
        this.vel.x += dx * 2.2;
        this.vel.y += dy * 2.2;
        this.vel.setLength(this.speed);
        this.combo = 0;
        this._flashPaddle();
        this.events.onHit?.('paddle');
      }
    }

    // escaped past the window — miss
    if (p.z > 1.0) {
      this.lives--;
      this.combo = 0;
      this.events.onMiss?.(this.lives);
      if (this.lives <= 0) {
        this.state = 'over';
        this.events.onGameOver?.(this.score);
      } else {
        this.state = 'dead';
        this._deadT = 1.2;
      }
      return;
    }

    // blocks
    for (const b of this.blocks) {
      if (b.dying > 0) continue;
      const m = b.mesh.position;
      const cx = clamp(p.x, m.x - b.hw, m.x + b.hw);
      const cy = clamp(p.y, m.y - b.hh, m.y + b.hh);
      const cz = clamp(p.z, m.z - b.hd, m.z + b.hd);
      const ddx = p.x - cx, ddy = p.y - cy, ddz = p.z - cz;
      if (ddx * ddx + ddy * ddy + ddz * ddz < BALL_R * BALL_R) {
        // reflect on the dominant penetration axis
        const ax = Math.abs(ddx), ay = Math.abs(ddy), az = Math.abs(ddz);
        if (az >= ax && az >= ay) this.vel.z = Math.sign(ddz || 1) * Math.abs(this.vel.z);
        else if (ax >= ay) this.vel.x = Math.sign(ddx || 1) * Math.abs(this.vel.x);
        else this.vel.y = Math.sign(ddy || 1) * Math.abs(this.vel.y);
        b.dying = 1;
        this.combo++;
        this.score += 10 * this.combo;
        this.events.onBlock?.(this.combo, this.score);
        break;
      }
    }

    if (this.blocks.every(b => b.dying > 0) && this.state === 'play') {
      this.speed *= 1.07;
      this._spawnWave();
    }
  }

  _flashPaddle() {
    this.paddleFill.material.opacity = 0.45;
    setTimeout(() => { this.paddleFill.material.opacity = 0.10; }, 120);
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
