// HUD: DOM-Overlay-Steuerung (Score, Wellen, Balken, Banner, Popups, Screens).

export class HUD {
  constructor() {
    this.el = {
      score: document.getElementById("score"),
      wave: document.getElementById("wave"),
      combo: document.getElementById("combo"),
      hpFill: document.getElementById("hp-fill"),
      ultFill: document.getElementById("ult-fill"),
      ult: document.getElementById("ult"),
      banner: document.getElementById("banner"),
      popups: document.getElementById("popups"),
      start: document.getElementById("overlay-start"),
      over: document.getElementById("overlay-over"),
      finalScore: document.getElementById("final-score"),
      finalWave: document.getElementById("final-wave"),
      startBtn: document.getElementById("start-btn"),
      restartBtn: document.getElementById("restart-btn"),
    };
    this._bannerTimer = null;
  }

  setScore(v) {
    this.el.score.textContent = "SCORE " + v.toLocaleString("de-DE");
  }

  setWave(n) {
    this.el.wave.textContent = "WAVE " + n;
  }

  setCombo(mult) {
    if (mult > 1) {
      this.el.combo.textContent = "COMBO ×" + mult;
      this.el.combo.classList.add("show");
    } else {
      this.el.combo.classList.remove("show");
    }
  }

  setHp(hp, max) {
    this.el.hpFill.style.width = Math.max(0, (hp / max) * 100) + "%";
  }

  setUltimate(ratio, ready) {
    this.el.ultFill.style.width = Math.min(100, ratio * 100) + "%";
    this.el.ult.classList.toggle("ready", ready);
  }

  banner(main, sub = "") {
    const b = this.el.banner;
    b.innerHTML = sub ? `${main}<span class="sub">${sub}</span>` : main;
    b.classList.add("show");
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => b.classList.remove("show"), 1400);
  }

  // Floating-Text an Bildschirm-Koordinaten (x,y in px).
  popup(x, y, text, color = "#fff") {
    const d = document.createElement("div");
    d.className = "popup";
    d.textContent = text;
    d.style.left = x + "px";
    d.style.top = y + "px";
    d.style.color = color;
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 820);
  }

  showStart() {
    this.el.start.classList.remove("hidden");
    this.el.over.classList.add("hidden");
  }

  hideOverlays() {
    this.el.start.classList.add("hidden");
    this.el.over.classList.add("hidden");
  }

  showGameOver(score, wave) {
    this.el.finalScore.textContent = score.toLocaleString("de-DE");
    this.el.finalWave.textContent = wave;
    this.el.over.classList.remove("hidden");
  }
}
