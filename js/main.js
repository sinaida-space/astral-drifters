import { Stage } from './scene.js';
import { Game } from './game.js';
import { Orientation } from './orientation.js';
import { Drone } from './audio.js';
import { Voice } from './voice.js';
import { ECG } from './ecg.js';
import { isMobile, showGate } from './gate.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

if (!isMobile() && !DEBUG) {
  showGate();
} else {
  boot();
}

function boot() {
  const stage = new Stage(document.getElementById('scene'));
  stage.resize();
  const orient = new Orientation();
  const drone = new Drone();
  const voice = new Voice(document.getElementById('voice'));
  const ecg = new ECG(document.getElementById('ecg'));

  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), livesEl = $('lives');

  const game = new Game(stage, {
    onHit(kind) {
      if (kind === 'paddle') { drone.paddle(); ecg.beat(0.7); if (Math.random() < 0.25) voice.say('paddle', 1600); }
      else if (kind === 'wall') drone.wall();
      else drone.wall();
    },
    onBlock(combo, score) {
      drone.block(combo);
      ecg.beat(1);
      scoreEl.textContent = String(score).padStart(4, '0');
      if (combo >= 3) voice.say('combo', 2200);
    },
    onWave(n) {
      if (n > 1) { drone.wave(); voice.say('wave'); ecg.beat(1); }
    },
    onMiss(lives) {
      drone.miss();
      livesEl.textContent = '▮'.repeat(Math.max(lives, 0));
      voice.say('miss');
    },
    onGameOver(score) {
      drone.over();
      ecg.flatline();
      $('final-score').textContent = String(score).padStart(4, '0');
      $('final-remark').textContent = voice.pick('over');
      setTimeout(() => $('gameover').classList.remove('hidden'), 900);
    },
  });

  // ---- flow ----
  $('start').classList.remove('hidden');

  $('enter').addEventListener('click', async () => {
    drone.start();
    let ok = true;
    if (!DEBUG) ok = await orient.request();
    if (DEBUG || !ok) orient.enableMouseDebug();
    orient.calibrate();
    $('start').classList.add('hidden');
    $('hud').classList.remove('hidden');
    voice.say('serve');
    running = true;
  });

  $('again').addEventListener('click', () => {
    $('gameover').classList.add('hidden');
    ecg.revive();
    game.reset();
    scoreEl.textContent = '0000';
    livesEl.textContent = '▮▮▮';
    orient.calibrate(); // re-zero to however they hold the phone now
    voice.say('serve');
  });

  // tap anywhere = serve
  window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    if (running && game.serve()) ecg.beat(0.5);
  });

  // ---- loop ----
  let running = false;
  let last = performance.now();
  let elapsed = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;

    orient.update(dt);
    stage.updateCamera(orient.x, orient.y);

    if (running) {
      game.update(dt, elapsed);
      if (game.state === 'play') voice.tickIdle(dt);
      drone.setTension(Math.min((game.speed - 6) / 8, 1));
    }

    ecg.update(dt);
    stage.render(dt, elapsed);
  }
  requestAnimationFrame(frame);

  // recalibrate on visibility return — people put phones down
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { orient.calibrate(); drone.ctx?.resume(); }
  });
}
