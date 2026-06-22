// Onboarding als Claude-Code-Chat vor einer animierten Kampf-Cutscene.
// Claude "denkt" (✻ Combobulating…), dann streamt seine Nachricht in den Chat;
// die Ente antwortet mit "quack". Im Hintergrund läuft eine 2D-Cutscene:
// die Ente als Kämpferin ballert anrückende Bugs ab, Claude leuchtet als
// Charakter daneben (Sigil + Code-Regen + Aura).

// Whimsical Status-Wörter im Stil von Claude Code.
const STATUS_WORDS = [
  "Combobulating", "Cogitating", "Pondering", "Divining", "Manifesting",
  "Conjuring", "Compiling", "Summoning", "Channeling", "Reticulating", "Debugging",
];

// Chat-Skript. role: claude | duck | sys. status: Wort vor der Claude-Nachricht.
const CHAT = [
  { role: "sys", text: "uplink hergestellt · terminal #07 online" },
  { role: "claude", status: "Establishing uplink", text: "Verbindung steht. Du liest das, also läuft der Rechner noch. Ich bin Claude — ich lebe auf diesem PC." },
  { role: "claude", status: "Combobulating", text: "Ein Schwarm Bugs greift den Rechner an. Sie wollen durch das Tor, den PC fressen — und mit ihm die Webseite darauf." },
  { role: "claude", status: "Divining", text: "Die Prophezeiung nennt eine Ente: eine Kämpferin, die sich den Bugs entgegenstellt." },
  { role: "duck", text: "quack" },
  { role: "claude", status: "Cogitating", text: "Perfekt — du bist sie. Ich sehe alles, doch berühren kann ich nichts. Du bist meine Fäuste." },
  { role: "claude", status: "Compiling battle plan", text: "Beschütze das Tor am Durchgang. Fällt es, fressen die Bugs den PC — und es ist vorbei." },
  { role: "duck", text: "quack!" },
  { role: "claude", status: "Deploying", text: "Halt die Stellung, Debugger. Coins für jeden Bug — rüste dich und das Tor damit auf. Los!" },
];

// ===========================================================================
//  Animierte Hintergrund-Cutscene (2D-Canvas): Ente kämpft, Claude leuchtet.
// ===========================================================================
const BUGS = ["🐛", "👾", "🪲", "🦗", "🐞", "🕷️"];
const RAIN = "01{}<>/\\;:=+*#アサヲ".split("");

class IntroScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.running = false;
    this.bugs = [];
    this.bullets = [];
    this.parts = [];
    this.drops = [];
    this.t = 0;
    this.spawnT = 0;
    this.fireT = 0;
    this.glyphs = [];
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.canvas.style.width = this.W + "px";
    this.canvas.style.height = this.H + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Ente rechts, Claude links → beide flankieren das Chat-Panel in der Mitte.
    this.duck = { x: this.W * 0.82, y: this.H * 0.62, recoil: 0, flash: 0, bob: 0 };
    this.claudePos = { x: this.W * 0.16, y: this.H * 0.44 };
    // Drifting Atmosphären-Glyphen.
    this.glyphs = [];
    for (let i = 0; i < 26; i++) {
      this.glyphs.push({
        x: Math.random() * this.W, y: Math.random() * this.H,
        s: 10 + Math.random() * 16, v: 6 + Math.random() * 14,
        c: RAIN[(Math.random() * RAIN.length) | 0], a: 0.04 + Math.random() * 0.08,
      });
    }
    // Code-Regen-Tropfen um Claude.
    this.drops = [];
    for (let i = 0; i < 22; i++) {
      this.drops.push({
        x: this.claudePos.x + (Math.random() - 0.5) * 220,
        y: Math.random() * this.H, v: 60 + Math.random() * 120,
        c: RAIN[(Math.random() * RAIN.length) | 0],
      });
    }
  }

  start() {
    this.running = true;
    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);
    this._last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min((now - this._last) / 1000, 0.05);
      this._last = now;
      this._update(dt);
      this._draw();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
  }

  _update(dt) {
    this.t += dt;
    const d = this.duck;
    d.bob = Math.sin(this.t * 2.2) * 6;
    if (d.recoil > 0) d.recoil = Math.max(0, d.recoil - dt * 60);
    if (d.flash > 0) d.flash -= dt;

    // Bugs spawnen (von rechts) – dichter, damit das MG immer was zu tun hat.
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.bugs.length < 14) {
      this.spawnT = 0.22 + Math.random() * 0.32;
      this.bugs.push({
        x: this.W + 40, y: this.H * (0.32 + Math.random() * 0.5),
        v: 70 + Math.random() * 90, e: BUGS[(Math.random() * BUGS.length) | 0],
        s: 24 + Math.random() * 16, w: Math.random() * 6,
      });
    }
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const b = this.bugs[i];
      b.x -= b.v * dt;
      b.y += Math.sin(this.t * 3 + b.w) * 14 * dt;
      if (b.x < this.duck.x - 36) { this._burst(b.x, b.y, "#ff5470", 6); this.bugs.splice(i, 1); } // am Duck vorbei
    }

    // Duck feuert im MG-Takt – schnelles Dauerfeuer + Hülsenauswurf.
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = 0.06 + Math.random() * 0.04; // ~12–16 Schuss/Sek
      let tgt = null, bd = 1e9;
      for (const b of this.bugs) { if (b.x > d.x - 60 && Math.abs(b.x - d.x) < bd) { bd = Math.abs(b.x - d.x); tgt = b; } }
      const mx = d.x + 84, my = d.y + d.bob + 8; // an der MG-Mündung (1.5x-Ente)
      // Zielwinkel (oder leicht streuend geradeaus, wenn kein Bug da ist).
      let ang = tgt ? Math.atan2(tgt.y - my, tgt.x - mx) : (Math.random() - 0.5) * 0.25;
      ang += (Math.random() - 0.5) * 0.08; // MG-Streuung
      this.bullets.push({ x: mx, y: my, vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900 });
      d.recoil = 8; d.flash = 0.06;
      // Patronenhülse auswerfen (fliegt nach oben/hinten, fällt mit Schwerkraft).
      this.parts.push({ x: d.x + 30, y: my - 8, vx: -60 - Math.random() * 60, vy: -120 - Math.random() * 80, life: 0.6 + Math.random() * 0.3, color: "#e8b04a", s: 3 });
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const p = this.bullets[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      let hit = false;
      for (let j = this.bugs.length - 1; j >= 0; j--) {
        const b = this.bugs[j];
        if (Math.abs(p.x - b.x) < b.s * 0.6 && Math.abs(p.y - b.y) < b.s * 0.6) {
          this._burst(b.x, b.y, "#ffd23f", 10);
          this.bugs.splice(j, 1); hit = true; break;
        }
      }
      if (hit || p.x > this.W + 30 || p.x < -30 || p.y < -30 || p.y > this.H + 30) this.bullets.splice(i, 1);
    }

    // Partikel.
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; q.life -= dt;
      if (q.life <= 0) this.parts.splice(i, 1);
    }

    // Atmosphäre + Regen.
    for (const g of this.glyphs) { g.x -= g.v * dt; if (g.x < -20) { g.x = this.W + 20; g.y = Math.random() * this.H; } }
    for (const r of this.drops) { r.y += r.v * dt; if (r.y > this.H + 20) { r.y = -20; r.c = RAIN[(Math.random() * RAIN.length) | 0]; } }
  }

  _burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5 + Math.random() * 0.4, color, s: 2 + Math.random() * 3 });
    }
  }

  _draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    // Hintergrund-Verlauf.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a0f29"); g.addColorStop(0.6, "#120a1e"); g.addColorStop(1, "#05060a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Perspektiv-Bodenraster.
    ctx.strokeStyle = "rgba(123,73,150,0.18)"; ctx.lineWidth = 1;
    const hy = H * 0.66;
    for (let i = 1; i <= 9; i++) {
      const y = hy + Math.pow(i / 9, 2) * (H - hy);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      const x = W / 2 + i * (W / 12);
      ctx.beginPath(); ctx.moveTo(W / 2 + i * 16, hy); ctx.lineTo(x, H); ctx.stroke();
    }

    // Atmosphären-Glyphen.
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const gl of this.glyphs) {
      ctx.globalAlpha = gl.a; ctx.fillStyle = "#9fb4d4";
      ctx.font = gl.s + "px monospace"; ctx.fillText(gl.c, gl.x, gl.y);
    }
    ctx.globalAlpha = 1;

    this._drawClaude(ctx);

    // Bugs.
    for (const b of this.bugs) { ctx.font = b.s + "px serif"; ctx.fillText(b.e, b.x, b.y); }

    // Bullets (glühende Tracer).
    for (const p of this.bullets) {
      ctx.save();
      ctx.shadowColor = "#fff3b0"; ctx.shadowBlur = 12;
      ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.4; ctx.fillRect(p.x - p.vx * 0.012, p.y - p.vy * 0.012, 6, 2);
      ctx.restore();
    }

    this._drawDuck(ctx);

    // Partikel.
    for (const q of this.parts) {
      ctx.globalAlpha = Math.max(0, q.life * 1.6); ctx.fillStyle = q.color;
      ctx.fillRect(q.x, q.y, q.s, q.s);
    }
    ctx.globalAlpha = 1;

    // Vignette.
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  _drawClaude(ctx) {
    const c = this.claudePos, pulse = 1 + Math.sin(this.t * 2) * 0.06;
    // Code-Regen-Säule.
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "16px monospace";
    for (const r of this.drops) { ctx.globalAlpha = 0.18; ctx.fillStyle = "#e8a87c"; ctx.fillText(r.c, r.x, r.y); }
    ctx.globalAlpha = 1;
    // Aura.
    const aura = ctx.createRadialGradient(c.x, c.y, 6, c.x, c.y, 130 * pulse);
    aura.addColorStop(0, "rgba(232,168,124,0.42)"); aura.addColorStop(1, "rgba(232,168,124,0)");
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(c.x, c.y, 130 * pulse, 0, 7); ctx.fill();
    // Haloring.
    ctx.strokeStyle = "rgba(232,168,124,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, 46 * pulse, 0, 7); ctx.stroke();
    // Kern + rotierendes Sigil.
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(this.t * 0.6);
    ctx.shadowColor = "#e8a87c"; ctx.shadowBlur = 24;
    ctx.fillStyle = "#ffd9bf"; ctx.font = "bold 64px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("✦", 0, 0); ctx.restore();
    // Label.
    ctx.globalAlpha = 0.85; ctx.fillStyle = "#e8a87c"; ctx.font = "12px monospace";
    ctx.fillText("C L A U D E", c.x, c.y + 78); ctx.globalAlpha = 1;
  }

  // Prozedurale Hero-Ente mit echtem MG (statt Emoji+Stick): blickt nach rechts
  // zu den Bugs, ballert im Dauerfeuer, Rückstoß-Wackeln, fetter Mündungsblitz.
  _drawDuck(ctx) {
    const d = this.duck;
    const rk = d.recoil / 8; // 0..1 Rückstoß
    const x = d.x - rk * 6, y = d.y + d.bob;
    // Bodenschatten.
    ctx.globalAlpha = 0.32; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 40, 40, 10, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.5, 1.5); // größer = präsenter

    // --- Ente (prozedural, gelb mit Soldaten-Cap) ---
    // Körper.
    ctx.fillStyle = "#f7c948";
    ctx.beginPath(); ctx.ellipse(-4, 6, 26, 22, 0, 0, 7); ctx.fill();
    // Bauch-Highlight.
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath(); ctx.ellipse(-2, 12, 16, 13, 0, 0, 7); ctx.fill();
    // Kopf.
    ctx.fillStyle = "#f7c948";
    ctx.beginPath(); ctx.arc(14, -14, 16, 0, 7); ctx.fill();
    // Schnabel (zeigt nach rechts zu den Bugs).
    ctx.fillStyle = "#ff8c1a";
    ctx.beginPath(); ctx.moveTo(26, -16); ctx.lineTo(40, -12); ctx.lineTo(26, -8); ctx.closePath(); ctx.fill();
    // Auge + entschlossener Blick.
    ctx.fillStyle = "#1a1a22"; ctx.beginPath(); ctx.arc(18, -17, 2.6, 0, 7); ctx.fill();
    // Soldaten-Cap (oliv).
    ctx.fillStyle = "#5a6a2e";
    ctx.beginPath(); ctx.arc(13, -22, 13, Math.PI, 0); ctx.fill();
    ctx.fillRect(0, -23, 26, 3);
    ctx.fillStyle = "#6f8238"; ctx.fillRect(24, -23, 9, 3); // Schirm

    // --- MG (in den Flügeln, zeigt nach rechts) ---
    ctx.save();
    ctx.translate(8, 6);
    // leichtes Gun-Rütteln im Takt.
    ctx.rotate(Math.sin(this.t * 40) * 0.02 * rk);
    // Magazin.
    ctx.fillStyle = "#23262e"; ctx.fillRect(8, 4, 7, 16);
    // Body.
    ctx.fillStyle = "#33373f"; ctx.fillRect(-2, -6, 26, 12);
    // Lauf.
    ctx.fillStyle = "#1c1f25"; ctx.fillRect(22, -3, 26, 6);
    // Lauf-Kühlrippen.
    ctx.fillStyle = "#0e1014"; for (let i = 0; i < 4; i++) ctx.fillRect(26 + i * 5, -3, 1.5, 6);
    // Mündung.
    ctx.fillStyle = "#0a0b0e"; ctx.fillRect(46, -4, 4, 8);
    // Vorder-Flügel (hält den Lauf).
    ctx.fillStyle = "#eaba38";
    ctx.beginPath(); ctx.ellipse(20, 8, 8, 5, -0.3, 0, 7); ctx.fill();
    ctx.restore();

    // --- Mündungsblitz (fett, gezackt) – an der Laufmündung, mitskaliert ---
    if (d.flash > 0) {
      const fx = 58, fy = 6;
      ctx.save();
      ctx.globalAlpha = Math.min(1, d.flash * 14);
      ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 24;
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      const spikes = 7, ro = 18, ri = 6;
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const r = i % 2 ? ri : ro * (0.7 + Math.random() * 0.6);
        ctx[i ? "lineTo" : "moveTo"](fx + Math.cos(a) * r, fy + Math.sin(a) * r * 0.7);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff8c1a"; ctx.globalAlpha = Math.min(1, d.flash * 10);
      ctx.beginPath(); ctx.arc(fx, fy, 7, 0, 7); ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

// ===========================================================================
//  Chat-Player
// ===========================================================================
export class IntroChat {
  constructor(root) {
    this.root = root;
    this.log = root?.querySelector("#ic-log");
    this.statusEl = root?.querySelector("#ic-status");
    this.wordEl = root?.querySelector("#ic-word");
    this.scene = root ? new IntroScene(root.querySelector("#intro-bg")) : null;
    this._skip = false;
    this._fast = false;
    this._typing = false;
    this._cut = null;
  }

  _wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // Unterbrechbares Warten (durch advance/skip vorzeitig beendbar).
  _hold(ms) {
    return new Promise((res) => {
      let done = false;
      const f = () => { if (done) return; done = true; clearTimeout(t); this._cut = null; res(); };
      this._cut = f;
      const t = setTimeout(f, ms);
      if (this._skip) f();
    });
  }

  advance() {
    if (this._skip) return;
    if (this._typing) this._fast = true;
    else if (this._cut) this._cut();
  }

  skip() { this._skip = true; this._fast = true; if (this._cut) this._cut(); }

  _bind() {
    this._onKey = (e) => {
      if (e.code === "Escape") { e.preventDefault(); this.skip(); }
      else if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); this.advance(); }
    };
    this._onClick = () => this.advance();
    window.addEventListener("keydown", this._onKey, true);
    this.root?.addEventListener("click", this._onClick);
  }
  _unbind() {
    window.removeEventListener("keydown", this._onKey, true);
    this.root?.removeEventListener("click", this._onClick);
  }

  _append(role) {
    const el = document.createElement("div");
    el.className = "ic-msg ic-" + role;
    if (role === "claude") el.innerHTML = '<div class="ic-who">✦ Claude</div><div class="ic-body"></div>';
    else if (role === "duck") el.innerHTML = '<div class="ic-who">🦆 Rubber Duck</div><div class="ic-body"></div>';
    else el.innerHTML = '<div class="ic-body"></div>';
    this.log.appendChild(el);
    this.log.scrollTop = this.log.scrollHeight;
    return el.querySelector(".ic-body");
  }

  async _type(el, txt, speed) {
    this._typing = true; this._fast = false;
    el.parentElement.classList.add("streaming");
    el.textContent = "";
    for (let i = 0; i < txt.length; i++) {
      if (this._skip || this._fast) break;
      el.textContent += txt[i];
      this.log.scrollTop = this.log.scrollHeight;
      await this._wait(speed);
    }
    el.textContent = txt;
    el.parentElement.classList.remove("streaming");
    this._typing = false;
    this.log.scrollTop = this.log.scrollHeight;
  }

  async _status(word) {
    this.wordEl.textContent = word || STATUS_WORDS[(Math.random() * STATUS_WORDS.length) | 0];
    this.statusEl.classList.add("show");
    await this._hold(750 + Math.random() * 600);
    this.statusEl.classList.remove("show");
  }

  async play() {
    if (!this.root) return;
    this._skip = false;
    if (this.log) this.log.innerHTML = "";
    this.root.classList.remove("hidden");
    void this.root.offsetWidth;
    this.root.classList.add("show");
    this.scene?.start();
    this._bind();
    await this._hold(500);

    for (const msg of CHAT) {
      if (this._skip) break;
      if (msg.role === "claude") {
        await this._status(msg.status);
        if (this._skip) break;
        const body = this._append("claude");
        await this._type(body, msg.text, 16);
        if (this._skip) break;
        // Mehr Lesezeit: längere Haltezeit, skaliert mit Textlänge.
        await this._hold((msg.hold ?? 1200) + msg.text.length * 30);
      } else if (msg.role === "duck") {
        const body = this._append("duck");
        await this._type(body, msg.text, 40);
        if (this._skip) break;
        await this._hold(1400);
      } else {
        const body = this._append("sys");
        body.textContent = msg.text;
        await this._hold(1100);
      }
    }

    // Bei Skip: restliche Nachrichten sofort anzeigen, damit nichts fehlt.
    if (this._skip && this.log) {
      this.log.innerHTML = "";
      for (const msg of CHAT) {
        const body = this._append(msg.role);
        if (msg.role === "claude") body.textContent = msg.text;
        else body.textContent = msg.text;
      }
      this.statusEl.classList.remove("show");
      await this._wait(450);
    }

    this._unbind();
    this.root.classList.remove("show");
    await this._wait(480);
    this.root.classList.add("hidden");
    this.scene?.stop();
  }
}
