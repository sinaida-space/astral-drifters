// The interface watches you play. Encouragement, sarcasm, and questions
// that have nothing to do with the game — delivered flat, like lab notes.

const LINES = {
  serve: [
    'tap. the tunnel is waiting.',
    'serve when ready. it makes no difference to the tunnel.',
    'the ball is patient. are you?',
  ],
  paddle: [
    'contact.',
    'returned.',
    'still here.',
    'reflex intact. noted.',
  ],
  combo: [
    'clean.',
    'again.',
    'the tunnel approves. probably.',
    'you are getting good at breaking things.',
    'efficient. almost clinical.',
  ],
  miss: [
    'it went through you. things do that.',
    'a miss. record it and move on.',
    'the ball left. it was never yours.',
    'breathe. the tunnel is not going anywhere.',
  ],
  wave: [
    'field cleared. a new one condenses.',
    'deeper now. it gets faster. so do you.',
    'another layer. there is always another layer.',
    'the blocks return. persistence is their whole personality.',
  ],
  idle: [
    'what are you avoiding by playing this?',
    'when did you last look at something far away?',
    'what would you break, if breaking it fixed you?',
    'is your neck relaxed? it was not. now it is.',
    'who taught you to keep score?',
    'what do your hands know that you keep forgetting?',
    'if this tunnel had an end, would you want to reach it?',
    'you are holding a window. what else have you been holding?',
    'what small ritual makes your day feel right?',
    'what did you inherit — not things, but ways of being?',
  ],
  over: [
    'flatline. the score was never the point. it says here it was the point.',
    'session terminated. the tunnel remains. you should go outside.',
    'you lasted longer than the average signal. the average signal is very short.',
    'nothing is saved. take that as a threat or a mercy.',
  ],
};

export class Voice {
  constructor(el) {
    this.el = el;
    this._t = null;
    this._idleTimer = 0;
    this._lastIdle = -1;
  }

  say(category, holdMs = 3200) {
    const pool = LINES[category];
    if (!pool) return;
    this._show(pool[Math.floor(Math.random() * pool.length)], holdMs);
  }

  pick(category) {
    const pool = LINES[category];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Introspection surfaces on its own schedule, mid-play.
  tickIdle(dt) {
    this._idleTimer += dt;
    if (this._idleTimer > 24) {
      this._idleTimer = 0;
      let i;
      do { i = Math.floor(Math.random() * LINES.idle.length); } while (i === this._lastIdle);
      this._lastIdle = i;
      this._show(LINES.idle[i], 5200);
    }
  }

  _show(text, holdMs) {
    clearTimeout(this._t);
    this.el.textContent = '';
    this.el.classList.add('show');
    // typewriter
    let i = 0;
    const step = () => {
      this.el.textContent = text.slice(0, ++i);
      if (i < text.length) this._t = setTimeout(step, 22);
      else this._t = setTimeout(() => this.el.classList.remove('show'), holdMs);
    };
    step();
  }
}
