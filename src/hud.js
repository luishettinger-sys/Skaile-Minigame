// HUD: DOM-Overlay-Steuerung (Score, Wellen, Balken, Banner, Popups, Screens).

export class HUD {
  constructor() {
    this.el = {
      score: document.getElementById("score"),
      wave: document.getElementById("wave"),
      combo: document.getElementById("combo"),
      hpFill: document.getElementById("hp-fill"),
      ultFill: document.getElementById("ult-fill"),
      enFill: document.getElementById("en-fill"),
      ult: document.getElementById("ult"),
      banner: document.getElementById("banner"),
      popups: document.getElementById("popups"),
      start: document.getElementById("overlay-start"),
      over: document.getElementById("overlay-over"),
      pause: document.getElementById("overlay-pause"),
      levelup: document.getElementById("overlay-levelup"),
      lvlCards: document.getElementById("lvl-cards"),
      lvlSub: document.getElementById("lvl-sub"),
      resumeBtn: document.getElementById("resume-btn"),
      finalScore: document.getElementById("final-score"),
      finalWave: document.getElementById("final-wave"),
      finalHi: document.getElementById("final-hi"),
      startBtn: document.getElementById("start-btn"),
      restartBtn: document.getElementById("restart-btn"),
      xpFill: document.getElementById("xp-fill"),
      level: document.getElementById("level"),
      bossbar: document.getElementById("bossbar"),
      bossFill: document.getElementById("boss-fill"),
      bossLabel: document.getElementById("boss-label"),
      weapon: document.getElementById("weapon"),
      flash: document.getElementById("flash"),
      vignette: document.getElementById("vignette"),
      invOverlay: document.getElementById("overlay-inv"),
      invSlots: document.getElementById("inv-slots"),
      invItems: document.getElementById("inv-items"),
      invSort: document.getElementById("inv-sort"),
      invClose: document.getElementById("inv-close"),
      coins: document.getElementById("coins"),
      prompt: document.getElementById("prompt"),
      shopOverlay: document.getElementById("overlay-shop"),
      shopOffers: document.getElementById("shop-offers"),
      shopCoins: document.getElementById("shop-coins"),
      shopClose: document.getElementById("shop-close"),
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

  showPause() {
    this.el.pause.classList.remove("hidden");
  }

  hidePause() {
    this.el.pause.classList.add("hidden");
  }

  setWeapon(name, icon) {
    this.el.weapon.textContent = icon + " " + name.toUpperCase();
  }

  setEnergy(ratio) {
    this.el.enFill.style.width = Math.max(0, Math.min(100, ratio * 100)) + "%";
  }

  flash(color = "#ffffff", strength = 0.4) {
    const f = this.el.flash;
    f.style.transition = "none";
    f.style.background = color;
    f.style.opacity = String(strength);
    // im nächsten Frame ausblenden lassen
    requestAnimationFrame(() => {
      f.style.transition = "opacity 0.5s ease-out";
      f.style.opacity = "0";
    });
  }

  setVignette(intensity) {
    this.el.vignette.style.opacity = String(Math.max(0, Math.min(1, intensity)));
  }

  setXp(ratio, level) {
    this.el.xpFill.style.width = Math.min(100, ratio * 100) + "%";
    this.el.level.textContent = "LVL " + level;
  }

  setBoss(ratio, label) {
    this.el.bossbar.classList.remove("hidden");
    this.el.bossLabel.textContent = "☠ " + label;
    this.el.bossFill.style.width = Math.max(0, ratio * 100) + "%";
  }

  hideBoss() {
    this.el.bossbar.classList.add("hidden");
  }

  // choices: [{icon,name,desc}], onPick(index)
  showLevelUp(level, choices, onPick) {
    this.el.lvlSub.textContent = "Level " + level + " · Wähle ein Upgrade";
    this.el.lvlCards.innerHTML = "";
    choices.forEach((up, i) => {
      const card = document.createElement("div");
      card.className = "lvl-card";
      card.innerHTML =
        `<div class="icon">${up.icon}</div>` +
        `<div class="name">${up.name}</div>` +
        `<div class="desc">${up.desc}</div>`;
      card.addEventListener("click", () => onPick(i));
      this.el.lvlCards.appendChild(card);
    });
    this.el.levelup.classList.remove("hidden");
  }

  hideLevelUp() {
    this.el.levelup.classList.add("hidden");
  }

  setCoins(n) {
    this.el.coins.textContent = "🪙 " + n;
  }

  showPrompt(text) {
    this.el.prompt.textContent = text;
    this.el.prompt.classList.remove("hidden");
  }

  hidePrompt() {
    this.el.prompt.classList.add("hidden");
  }

  showShop() { this.el.shopOverlay.classList.remove("hidden"); }
  hideShop() { this.el.shopOverlay.classList.add("hidden"); }

  // offers: [{icon,name,desc,price}], coins, onBuy(i)
  renderShop(offers, coins, onBuy) {
    this.el.shopCoins.textContent = coins;
    this.el.shopOffers.innerHTML = "";
    offers.forEach((o, i) => {
      const d = document.createElement("div");
      const afford = coins >= o.price;
      d.className = "inv-cell" + (afford ? "" : " empty");
      d.innerHTML =
        `<div class="icon">${o.icon}</div><div class="nm">${o.name}</div>` +
        `<div class="ds">${o.desc}</div><div class="nm">${o.price} 🪙</div>`;
      if (afford) d.addEventListener("click", () => onBuy(i));
      this.el.shopOffers.appendChild(d);
    });
  }

  showInventory() {
    this.el.invOverlay.classList.remove("hidden");
  }

  hideInventory() {
    this.el.invOverlay.classList.add("hidden");
  }

  // inv: Inventory-Instanz, cbs: { onEquip(i), onUnequip(i) }
  renderInventory(inv, cbs) {
    const cell = (it, cls, onClick) => {
      const d = document.createElement("div");
      d.className = "inv-cell" + (cls ? " " + cls : "");
      if (it) {
        d.innerHTML =
          `<div class="icon">${it.icon}</div><div class="nm">${it.name}</div>` +
          `<div class="ds">${it.desc}</div>`;
      } else {
        d.innerHTML = `<div class="icon">＋</div><div class="nm">leer</div>`;
      }
      if (onClick) d.addEventListener("click", onClick);
      return d;
    };

    this.el.invSlots.innerHTML = "";
    inv.slots.forEach((it, i) => {
      this.el.invSlots.appendChild(
        it ? cell(it, "", () => cbs.onUnequip(i)) : cell(null, "empty", null)
      );
    });

    this.el.invItems.innerHTML = "";
    if (inv.items.length === 0) {
      this.el.invItems.appendChild(cell(null, "empty", null));
    } else {
      inv.items.forEach((it, i) => {
        this.el.invItems.appendChild(cell(it, "", () => cbs.onEquip(i)));
      });
    }
  }

  showGameOver(score, wave, highscore = 0) {
    this.el.finalScore.textContent = score.toLocaleString("de-DE");
    this.el.finalWave.textContent = wave;
    this.el.finalHi.textContent = highscore.toLocaleString("de-DE");
    this.el.over.classList.remove("hidden");
  }
}
