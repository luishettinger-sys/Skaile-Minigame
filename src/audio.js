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

    // SFX-Bus mit kurzem Hall → Raumtiefe, satter & „satisfying" statt trocken.
    // Alle Effekt-Sounds laufen über sfxBus (dry → master + ein wenig in den Hall).
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this._makeImpulse(0.5, 3.2);
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = 0.09; // dezent
    this.sfxBus.connect(this.reverbSend);
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.master);

    // Eigener Bus für die Musik (leiser als SFX, aber wahrnehmbar).
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.72;
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
    // Waffen-Sounds laufen über die (aufgewertete) Synthese mit Hall + Punch –
    // es liegen keine Waffen-Samples bei, daher gar nicht erst laden (vermeidet
    // unnötige 404s / Konsolen-Lärm). Optional: assets/sounds/weapons/<id>.mp3
    // ablegen und die folgende Zeile reaktivieren.
    // for (const id of ["blaster","shotgun","smg","rail","cannon","minigun","sniper","pulse"]) this._tryLoadSample("weapons", id, ["mp3","wav","ogg"], 0);
    // UI-Sounds: Voice-Samples für Kauf, harten Treffer, Wellen-Sieg.
    this._tryLoadSample("ui", "buy", ["mp3", "wav", "ogg"], 0);
    this._tryLoadSample("ui", "ouch", ["wav", "mp3", "ogg"], 0);
    this._tryLoadSample("ui", "yay", ["wav", "mp3", "ogg"], 0);
    this._tryLoadSample("ui", "boss", ["wav", "mp3", "ogg"], 0);
  }

  _tryLoadSample(dir, id, exts, i) {
    if (i >= exts.length) return;
    fetch(`./assets/sounds/${dir}/${id}.${exts[i]}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => this.ctx.decodeAudioData(b))
      .then((ab) => { this.buffers[id] = ab; })
      .catch(() => this._tryLoadSample(dir, id, exts, i + 1));
  }

  // Spielt ein geladenes Sample mit leichter Tonhöhen-Variation (kein Dauer-Loop-
  // Gefühl). Gibt false zurück, wenn kein Sample da ist → Synthese übernimmt.
  _playSample(id, { rateVar = 0.12, gain = 0.95 } = {}) {
    const buf = this.buffers[id];
    if (!buf || !this.ctx || this.muted) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 - rateVar / 2 + Math.random() * rateVar;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this._dest());
    src.start();
    return true;
  }

  // Ziel-Knoten für SFX (Bus mit Hall, falls vorhanden, sonst Master).
  _dest() { return this.sfxBus || this.master; }

  // Synthetische Impulsantwort (Rausch-Schweif) für den Convolver-Hall.
  _makeImpulse(dur = 0.5, decay = 3) {
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * dur));
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
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
    g.connect(this._dest());
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Klassisches "Quak" — abfallender Sägezahn mit kleinem Knick.
  quack() {
    this._tone({ type: "sawtooth", from: 620, to: 280, dur: 0.12, gain: 0.22 });
    this._tone({ type: "sawtooth", from: 300, to: 180, dur: 0.1, gain: 0.12, delay: 0.05 });
  }

  // Waffenschuss: knackiger Laser-"Pew" mit Klick-Transient + Sub-Körper.
  // Schichtung Transient → Ton → Sub gibt mehr „Punch" und Tiefe.
  shoot() {
    this._noise({ dur: 0.012, gain: 0.16, type: "highpass", freq: 3500 }); // Klick-Attack
    this._tone({ type: "square", from: 1050, to: 190, dur: 0.10, gain: 0.14 });
    this._tone({ type: "sawtooth", from: 560, to: 120, dur: 0.08, gain: 0.09, delay: 0.004 });
    this._tone({ type: "sine", from: 190, to: 58, dur: 0.07, gain: 0.10 }); // Sub-Thump
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
    src.connect(filt); filt.connect(g); g.connect(this._dest());
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
    this._noise({ dur: 0.02, gain: 0.30, type: "highpass", freq: 4200 });  // scharfer Crack
    this._noise({ dur: 0.22, gain: 0.30, type: "bandpass", freq: 1100 });   // Schrot-Wumms
    this._tone({ type: "square", from: 290, to: 58, dur: 0.18, gain: 0.17 });
    this._tone({ type: "sine", from: 150, to: 44, dur: 0.18, gain: 0.14 });  // Sub-Boom
  }

  smg() {
    this._noise({ dur: 0.008, gain: 0.10, type: "highpass", freq: 3200 }); // Klick
    this._tone({ type: "square", from: 880, to: 230, dur: 0.05, gain: 0.10 });
    this._tone({ type: "sine", from: 160, to: 70, dur: 0.04, gain: 0.06 }); // Mini-Sub
  }

  minigun() {
    this._noise({ dur: 0.007, gain: 0.08, type: "highpass", freq: 3600 });
    this._tone({ type: "sawtooth", from: 720, to: 280, dur: 0.04, gain: 0.08 });
    this._tone({ type: "sine", from: 150, to: 68, dur: 0.035, gain: 0.06 });
  }

  rail() {
    this._noise({ dur: 0.015, gain: 0.14, type: "highpass", freq: 5000 }); // Entlade-Knack
    this._tone({ type: "sawtooth", from: 1600, to: 180, dur: 0.30, gain: 0.18 });
    this._tone({ type: "sine", from: 400, to: 1800, dur: 0.26, gain: 0.12, delay: 0.02 }); // Schimmer
    this._tone({ type: "sine", from: 120, to: 50, dur: 0.16, gain: 0.10 }); // Sub
  }

  sniper() {
    this._noise({ dur: 0.05, gain: 0.32, type: "highpass", freq: 3000 });  // Peitschen-Crack
    this._tone({ type: "sawtooth", from: 1300, to: 110, dur: 0.28, gain: 0.20 });
    this._tone({ type: "sine", from: 180, to: 45, dur: 0.22, gain: 0.14 }); // tiefer Nachschlag
  }

  pulse() {
    this._noise({ dur: 0.01, gain: 0.08, type: "bandpass", freq: 2400 });
    this._tone({ type: "sine", from: 240, to: 760, dur: 0.18, gain: 0.18 });
    this._tone({ type: "triangle", from: 520, to: 170, dur: 0.16, gain: 0.12, delay: 0.02 });
    this._tone({ type: "sine", from: 150, to: 60, dur: 0.10, gain: 0.08 });
  }

  cannon() {
    this._noise({ dur: 0.03, gain: 0.22, type: "highpass", freq: 2600 }); // Mündungs-Crack
    this._noise({ dur: 0.32, gain: 0.30, type: "lowpass", freq: 300 });   // Donner
    this._tone({ type: "square", from: 130, to: 40, dur: 0.34, gain: 0.24 });
    this._tone({ type: "sine", from: 90, to: 30, dur: 0.36, gain: 0.18 }); // tiefer Sub-Boom
  }

  hit() {
    const v = 1 + (Math.random() - 0.5) * 0.35; // Tonhöhen-Variation → kein Maschinengewehr-Einerlei
    this._noise({ dur: 0.018, gain: 0.10, type: "bandpass", freq: 2600 * v }); // knackiger Impakt
    this._tone({ type: "square", from: 480 * v, to: 200 * v, dur: 0.05, gain: 0.10 });
  }

  bugDeath() {
    this._noise({ dur: 0.04, gain: 0.10, type: "lowpass", freq: 1200 }); // matschiger Squish
    this._tone({ type: "triangle", from: 220, to: 55, dur: 0.18, gain: 0.20 });
    this._tone({ type: "square", from: 520, to: 80, dur: 0.12, gain: 0.10 });
  }

  playerHurt() {
    this._tone({ type: "sawtooth", from: 160, to: 50, dur: 0.3, gain: 0.3 });
  }

  // Harter Treffer (viel Schaden): zusätzliches "Ouch"-Sample über dem
  // normalen Hurt-Ton. Fehlt die Datei → still (Hurt-Ton spielt ohnehin).
  ouch() {
    this._playSample("ouch", { rateVar: 0.06, gain: 0.85 });
  }

  ultimate() {
    // aufsteigender, glänzender Sweep
    this._tone({ type: "sine", from: 300, to: 1200, dur: 0.5, gain: 0.25 });
    this._tone({ type: "triangle", from: 150, to: 600, dur: 0.6, gain: 0.18, delay: 0.05 });
  }

  // Steigt mit der Einsammel-Serie (cha-ching-Streak).
  pickup(streak = 0) {
    const f = 880 + Math.min(streak, 18) * 52;
    this._tone({ type: "sine", from: f, to: f * 1.5, dur: 0.08, gain: 0.1 });
    this._tone({ type: "triangle", from: f * 1.5, to: f * 2, dur: 0.06, gain: 0.04, delay: 0.03 });
  }

  // Kauf/Auswahl bestätigt (Waffe, Boon, Automation, Meta-Upgrade, Skin):
  // befriedigendes "Yummy"-Sample. Fehlt die Datei → synthetischer Fallback.
  buy() {
    if (this._playSample("buy", { rateVar: 0.05, gain: 0.9 })) return;
    this.levelUp();
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

  // Welle überstanden: fröhliches "Yay"-Sample. Fehlt die Datei → kleiner
  // synthetischer Jubel-Sweep als Fallback.
  yay() {
    if (this._playSample("yay", { rateVar: 0.05, gain: 0.85 })) return;
    this.levelUp();
  }

  // Boss erscheint: dramatisches Sample. Fehlt die Datei → tiefer Gong-Sweep.
  bossAppear() {
    if (this._playSample("boss", { rateVar: 0.02, gain: 0.95 })) return;
    this._tone({ type: "sawtooth", from: 90, to: 200, dur: 0.7, gain: 0.28 });
    this._tone({ type: "square", from: 60, to: 120, dur: 0.8, gain: 0.18, delay: 0.05 });
  }

  gameOver() {
    this._tone({ type: "sawtooth", from: 400, to: 60, dur: 0.9, gain: 0.3 });
  }
}
