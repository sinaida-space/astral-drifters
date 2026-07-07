# ASTRAL DRIFTERS

An anamorphic tunnel behind your screen. The phone is the window — and the racket.

Off-axis (Kooima) projection driven by the gyroscope makes the screen read as a
window into a real teal-lit tunnel. The paddle stays at the center of the screen;
you aim by moving the phone. Endless Arkanoid run, escalating speed, session-only
score, procedural Web Audio drone, and an interface that asks you questions that
have nothing to do with the game.

**Mobile only.** Desktop shows a QR code. (`?debug` in the URL bypasses the gate
and emulates the gyro with the mouse — for development.)

## Stack

Vanilla ES modules, Three.js via CDN import map, no build step.
Fonts self-hosted (VT323, Space Mono). No audio files — the drone is synthesized.

## Run locally

```
python3 -m http.server 8080
# open http://localhost:8080/?debug
```

## Deploy

GitHub Pages from `main` root. Gyroscope requires HTTPS — Pages provides it.

---

sin.ai.da · sinaida.eu
