// Sound per WebAudio-Synthese — kein Asset nötig, 0 KB, latenzarm.
// Quak, Treffer, Bug-Tod, Spieler-Schaden, Ultimate.

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.buffers = {}; // dekodierte Waffen-Samples (sound-id -> AudioBuffer)
  }

  // Erst nach erster User-Geste erlaubt (Autoplay-Policy).
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.42;
    // Sanfter Limiter → cleaner, „satisfying", keine harten Peaks.
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // Eigener Bus für die Musik (leiser als SFX).
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.musicOn = false;
    this._mstep = 0;

    this._loadSamples(); // optionale echte Waffen-Sounds laden (falls vorhanden)
  }

  // Lädt optionale CC0-Samples aus assets/sounds/weapons/<sound>.{mp3,wav,ogg}.
  // Fehlt eine Datei, bleibt automatisch der synthetische Sound aktiv.
  _loadSamples() {
    if (this._samplesRequested || !this.ctx) return;
    this._samplesRequested = true;
    const ids = ["blaster", "shotgun", "smg", "rail", "cannon", "minigun", "sniper", "pulse"];
    for (const id of ids) this._tryLoadSample(id, ["mp3", "wav", "ogg"], 0);
  }

  _tryLoadSample(id, exts, i) {
    if (i >= exts.length) return;
    fetch(`./assets/sounds/weapons/${id}.${exts[i]}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => this.ctx.decodeAudioData(b))
      .then((ab) => { this.buffers[id] = ab; })
      .catch(() => this._tryLoadSample(id, exts, i + 1));
  }

  // Spielt ein geladenes Sample mit leichter Tonhöhen-Variation (kein Dauer-Loop-
  // Gefühl). Gibt false zurück, wenn kein Sample da ist → Synthese übernimmt.
  _playSample(id) {
    const buf = this.buffers[id];
    if (!buf || !this.ctx || this.muted) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = this.ctx.createGain();
    g.gain.value = 0.95;
    src.connect(g);
    g.connect(this.master);
    src.start();
    return true;
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.42;
    return this.muted;
  }

  // --- Generative Lo-Fi-Musik (Pad + Bass + sparsame Melodie) ---------------
  _musicNote(freq, dur, gain, type = "sine", attack = 0.04) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this._musicTimer = setInterval(() => this._musicStep(), 195); // ~16tel @ ~77 BPM
  }

  stopMusic() {
    this.musicOn = false;
    clearInterval(this._musicTimer);
  }

  _musicStep() {
    if (!this.musicOn || !this.ctx || this.muted) return;
    const s = this._mstep++;
    const prog = [110.0, 87.31, 130.81, 98.0]; // Am – F – C – G (Bass-Hz)
    const root = prog[Math.floor(s / 16) % prog.length];
    if (s % 16 === 0) {
      this._musicNote(root * 2, 1.9, 0.05, "triangle", 0.25);
      this._musicNote(root * 3, 1.9, 0.035, "sine", 0.3);
      this._musicNote(root * 4, 1.9, 0.022, "sine", 0.35);
    }
    if (s % 4 === 0) this._musicNote(root, 0.5, 0.06, "sine", 0.02); // Bass
    if (s % 2 === 1) this._noise({ dur: 0.03, gain: 0.012, type: "highpass", freq: 7000 }); // Hi-Hat
    if (Math.random() < 0.16) {
      const pent = [1, 1.2, 1.5, 1.8, 2, 2.4];
      this._musicNote(root * 3 * pent[Math.floor(Math.random() * pent.length)], 0.4, 0.03, "triangle", 0.02);
    }
  }

  // Kill-Sound: steigt mit der Combo (befriedigender Streak).
  killSound(combo = 0) {
    const base = 200 + Math.min(combo, 24) * 28;
    this._tone({ type: "triangle", from: base, to: base * 0.4, dur: 0.16, gain: 0.16 });
    this._tone({ type: "square", from: base * 2.2, to: base * 0.6, dur: 0.1, gain: 0.06 });
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

  // Gefilterter Rausch-Burst (für Schrot, Explosionen, Cracks).
  _noise({ dur = 0.2, gain = 0.2, type = "lowpass", freq = 1000, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur);
  }

  // Dispatcher: spielt den Sound der aktuellen Waffe.
  // Echtes Sample bevorzugt; fehlt es, synthetischer Fallback.
  weapon(id) {
    if (this._playSample(id)) return;
    switch (id) {
      case "shotgun": return this.shotgun();
      case "smg": return this.smg();
      case "rail": return this.rail();
      case "cannon": return this.cannon();
      case "minigun": return this.minigun();
      case "sniper": return this.sniper();
      case "pulse": return this.pulse();
      default: return this.shoot();
    }
  }

  shotgun() {
    this._noise({ dur: 0.18, gain: 0.28, type: "bandpass", freq: 1400 });
    this._tone({ type: "square", from: 300, to: 70, dur: 0.16, gain: 0.16 });
  }

  smg() {
    this._tone({ type: "square", from: 820, to: 240, dur: 0.05, gain: 0.1 });
    this._noise({ dur: 0.04, gain: 0.06, type: "highpass", freq: 2000 });
  }

  minigun() {
    this._tone({ type: "sawtooth", from: 700, to: 300, dur: 0.04, gain: 0.08 });
    this._noise({ dur: 0.03, gain: 0.05, type: "bandpass", freq: 1800 });
  }

  rail() {
    this._tone({ type: "sawtooth", from: 1500, to: 200, dur: 0.3, gain: 0.18 });
    this._tone({ type: "sine", from: 400, to: 1700, dur: 0.26, gain: 0.12, delay: 0.02 });
  }

  sniper() {
    this._noise({ dur: 0.05, gain: 0.3, type: "highpass", freq: 3000 });
    this._tone({ type: "sawtooth", from: 1200, to: 120, dur: 0.28, gain: 0.2 });
  }

  pulse() {
    this._tone({ type: "sine", from: 240, to: 700, dur: 0.18, gain: 0.18 });
    this._tone({ type: "triangle", from: 500, to: 180, dur: 0.16, gain: 0.12, delay: 0.02 });
  }

  cannon() {
    this._noise({ dur: 0.3, gain: 0.3, type: "lowpass", freq: 320 });
    this._tone({ type: "square", from: 130, to: 42, dur: 0.34, gain: 0.26 });
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

  pickup() {
    this._tone({ type: "sine", from: 880, to: 1320, dur: 0.08, gain: 0.1 });
  }

  dash() {
    this._tone({ type: "sine", from: 700, to: 1400, dur: 0.12, gain: 0.12 });
  }

  levelUp() {
    this._tone({ type: "triangle", from: 600, to: 900, dur: 0.12, gain: 0.18 });
    this._tone({ type: "triangle", from: 900, to: 1300, dur: 0.16, gain: 0.16, delay: 0.1 });
  }

  waveStart() {
    this._tone({ type: "sine", from: 500, to: 800, dur: 0.15, gain: 0.18 });
    this._tone({ type: "sine", from: 800, to: 1000, dur: 0.15, gain: 0.15, delay: 0.12 });
  }

  gameOver() {
    this._tone({ type: "sawtooth", from: 400, to: 60, dur: 0.9, gain: 0.3 });
  }
}
