// Sound per WebAudio-Synthese — kein Asset nötig, 0 KB, latenzarm.
// Quak, Treffer, Bug-Tod, Spieler-Schaden, Ultimate.

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  // Erst nach erster User-Geste erlaubt (Autoplay-Policy).
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  _tone({ type = "sine", from, to, dur, gain = 0.3, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Klassisches "Quak" — abfallender Sägezahn mit kleinem Knick.
  quack() {
    this._tone({ type: "sawtooth", from: 620, to: 280, dur: 0.12, gain: 0.22 });
    this._tone({ type: "sawtooth", from: 300, to: 180, dur: 0.1, gain: 0.12, delay: 0.05 });
  }

  // Waffenschuss: knackiger Laser-"Pew" mit kleinem Enten-Quak-Oberton.
  shoot() {
    this._tone({ type: "square", from: 900, to: 180, dur: 0.11, gain: 0.16 });
    this._tone({ type: "sawtooth", from: 520, to: 130, dur: 0.09, gain: 0.1, delay: 0.005 });
    this._tone({ type: "sawtooth", from: 680, to: 320, dur: 0.06, gain: 0.07 });
  }

  hit() {
    this._tone({ type: "square", from: 420, to: 220, dur: 0.06, gain: 0.12 });
  }

  bugDeath() {
    this._tone({ type: "triangle", from: 200, to: 60, dur: 0.18, gain: 0.2 });
    this._tone({ type: "square", from: 520, to: 90, dur: 0.12, gain: 0.1 });
  }

  playerHurt() {
    this._tone({ type: "sawtooth", from: 160, to: 50, dur: 0.3, gain: 0.3 });
  }

  ultimate() {
    // aufsteigender, glänzender Sweep
    this._tone({ type: "sine", from: 300, to: 1200, dur: 0.5, gain: 0.25 });
    this._tone({ type: "triangle", from: 150, to: 600, dur: 0.6, gain: 0.18, delay: 0.05 });
  }

  waveStart() {
    this._tone({ type: "sine", from: 500, to: 800, dur: 0.15, gain: 0.18 });
    this._tone({ type: "sine", from: 800, to: 1000, dur: 0.15, gain: 0.15, delay: 0.12 });
  }

  gameOver() {
    this._tone({ type: "sawtooth", from: 400, to: 60, dur: 0.9, gain: 0.3 });
  }
}
