// HUD: DOM-Overlay-Steuerung (Score, Wellen, Balken, Banner, Popups, Screens).
import { SKINS, SKIN_ORDER } from "./skins.js";
import { META_UPGRADES, META_ORDER, metaPrice } from "./metaupgrades.js";
import { FORGE_MODS, FORGE_ORDER, forgeCost } from "./forge.js";
import { RESEARCH, RESEARCH_ORDER, researchAvailable } from "./research.js";
import { CHIP_TYPES, CHIP_ORDER, GRID_N, slotStrength, sameNeighbors } from "./chips.js";
import { FAB_ITEMS, FAB_ORDER } from "./fabricator.js";

export class HUD {
  constructor() {
    this.el = {
      score: document.getElementById("score"),
      wave: document.getElementById("wave"),
      combo: document.getElementById("combo"),
      hpFill: document.getElementById("hp-fill"),
      ultFill: document.getElementById("ult-fill"),
      heat: document.getElementById("heat"),
      heatFill: document.getElementById("heat-fill"),
      heatLabel: document.getElementById("heat-label"),
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
      finalKills: document.getElementById("final-kills"),
      finalHi: document.getElementById("final-hi"),
      remaining: document.getElementById("remaining"),
      minimap: document.getElementById("minimap"),
      metaLine: document.getElementById("meta-line"),
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
      bossIntro: document.getElementById("boss-intro"),
      cwBugName: document.getElementById("cw-bug-name"),
      toasts: document.getElementById("toasts"),
      invOverlay: document.getElementById("overlay-inv"),
      invSlots: document.getElementById("inv-slots"),
      invItems: document.getElementById("inv-items"),
      invSort: document.getElementById("inv-sort"),
      invClose: document.getElementById("inv-close"),
      coins: document.getElementById("coins"),
      mats: document.getElementById("mats"),
      prompt: document.getElementById("prompt"),
      guide: document.getElementById("guide"),
      guideText: document.getElementById("guide-text"),
      buffs: document.getElementById("buffs"),
      gadget: document.getElementById("gadget"),
      shopOverlay: document.getElementById("overlay-shop"),
      shopOffers: document.getElementById("shop-offers"),
      shopCoins: document.getElementById("shop-coins"),
      shopClose: document.getElementById("shop-close"),
      skinsBtn: document.getElementById("skins-btn"),
      skinsBtnOver: document.getElementById("skins-btn-over"),
      skinsBtnPause: document.getElementById("skins-btn-pause"),
      skinsBtnShop: document.getElementById("skins-btn-shop"),
      skinsOverlay: document.getElementById("overlay-skins"),
      skinGrid: document.getElementById("skin-grid"),
      skinBank: document.getElementById("skin-bank"),
      skinBalanceLine: document.getElementById("skin-balance-line"),
      skinsClose: document.getElementById("skins-close"),
      upgradesBtn: document.getElementById("upgrades-btn"),
      upgradesBtnPause: document.getElementById("upgrades-btn-pause"),
      upgradesBtnOver: document.getElementById("upgrades-btn-over"),
      upgradesOverlay: document.getElementById("overlay-upgrades"),
      upgradeGrid: document.getElementById("upgrade-grid"),
      upgradeBank: document.getElementById("upgrade-bank"),
      upgradesClose: document.getElementById("upgrades-close"),
      forgeOverlay: document.getElementById("overlay-forge"),
      forgeGrid: document.getElementById("forge-grid"),
      forgeScrap: document.getElementById("forge-scrap"),
      forgeClose: document.getElementById("forge-close"),
      researchOverlay: document.getElementById("overlay-research"),
      researchGrid: document.getElementById("research-grid"),
      researchData: document.getElementById("research-data"),
      researchClose: document.getElementById("research-close"),
      chipsOverlay: document.getElementById("overlay-chips"),
      chipBoard: document.getElementById("chip-board"),
      chipPalette: document.getElementById("chip-palette"),
      chipBal: document.getElementById("chip-bal"),
      chipsClose: document.getElementById("chips-close"),
      fabOverlay: document.getElementById("overlay-fab"),
      fabGrid: document.getElementById("fab-grid"),
      fabScrap: document.getElementById("fab-scrap"),
      fabProgress: document.getElementById("fab-progress"),
      fabClose: document.getElementById("fab-close"),
      belt: document.getElementById("belt"),
      lorePop: document.getElementById("lore-pop"),
      loreIcon: document.getElementById("lore-icon"),
      loreTitle: document.getElementById("lore-title"),
      loreText: document.getElementById("lore-text"),
      loreCard: document.getElementById("lore-card"),
      spPips: document.getElementById("sp-pips"),
      spLabel: document.getElementById("sp-label"),
      victoryOverlay: document.getElementById("overlay-victory"),
      victoryScore: document.getElementById("victory-score"),
      victoryWave: document.getElementById("victory-wave"),
      victoryKills: document.getElementById("victory-kills"),
      victoryContinue: document.getElementById("victory-continue"),
      victoryMenu: document.getElementById("victory-menu"),
      boonOverlay: document.getElementById("overlay-boon"),
      boonCards: document.getElementById("boon-cards"),
      objective: document.getElementById("objective"),
      boonbar: document.getElementById("boonbar"),
    };
    this._bannerTimer = null;
  }

  // --- Lab-Ausbau (permanente Meta-Upgrades) --------------------------------
  showUpgrades() { this.el.upgradesOverlay.classList.remove("hidden"); }
  hideUpgrades() { this.el.upgradesOverlay.classList.add("hidden"); }

  renderUpgrades(meta, onBuy) {
    const grid = this.el.upgradeGrid;
    if (!grid) return;
    const bank = meta.coins ?? 0;
    if (this.el.upgradeBank) this.el.upgradeBank.textContent = bank.toLocaleString("de-DE");
    grid.innerHTML = "";
    for (const key of META_ORDER) {
      const def = META_UPGRADES[key];
      if (!def) continue;
      const lvl = meta.upgrades?.[key] || 0;
      const maxed = lvl >= def.max;
      const price = metaPrice(def, lvl);
      const affordable = !maxed && bank >= price;
      const card = document.createElement("div");
      card.className =
        "skin-card up-card " + (maxed ? "equipped" : affordable ? "affordable owned" : "locked");
      // Stufen-Pips (gefüllt = gekauft).
      let pips = "";
      for (let i = 0; i < def.max; i++) pips += `<span class="pip${i < lvl ? " on" : ""}"></span>`;
      const status = maxed ? "✓ MAX" : `${price.toLocaleString("de-DE")} 🪙`;
      card.innerHTML =
        `<div class="skin-emoji">${def.icon}</div>` +
        `<div class="skin-name">${def.name}</div>` +
        `<div class="up-desc">${def.short}</div>` +
        `<div class="up-pips">${pips}</div>` +
        `<div class="skin-status">Lv ${lvl}/${def.max} · ${status}</div>`;
      if (!maxed) card.onclick = () => onBuy(key);
      grid.appendChild(card);
    }
  }

  // --- Schmiede (permanente Waffen-Mods aus Schrott) ------------------------
  showForge() { this.el.forgeOverlay?.classList.remove("hidden"); }
  hideForge() { this.el.forgeOverlay?.classList.add("hidden"); }

  // crafted = { id: lvl }, scrap = Zahl, onCraft(id).
  renderForge(crafted, scrap, onCraft) {
    const grid = this.el.forgeGrid;
    if (!grid) return;
    if (this.el.forgeScrap) this.el.forgeScrap.textContent = (scrap | 0).toLocaleString("de-DE");
    grid.innerHTML = "";
    for (const id of FORGE_ORDER) {
      const def = FORGE_MODS[id];
      if (!def) continue;
      const lvl = (crafted?.[id] || 0) | 0;
      const maxed = lvl >= def.max;
      const cost = maxed ? 0 : forgeCost(id, lvl);
      const affordable = !maxed && scrap >= cost;
      const card = document.createElement("div");
      card.className = "skin-card up-card " + (maxed ? "equipped" : affordable ? "affordable owned" : "locked");
      let pips = "";
      for (let i = 0; i < def.max; i++) pips += `<span class="pip${i < lvl ? " on" : ""}"></span>`;
      const status = maxed ? "✓ MAX" : `${cost.toLocaleString("de-DE")} 🔩`;
      const nextDesc = maxed ? def.desc(lvl) : def.desc(lvl + 1);
      card.innerHTML =
        `<div class="skin-emoji">${def.icon}</div>` +
        `<div class="skin-name">${def.name}</div>` +
        `<div class="up-desc">${nextDesc}</div>` +
        `<div class="up-pips">${pips}</div>` +
        `<div class="skin-status">Lv ${lvl}/${def.max} · ${status}</div>`;
      if (!maxed) card.onclick = () => onCraft(id);
      grid.appendChild(card);
    }
  }

  // --- Fabrikator (3D-Drucker) ----------------------------------------------
  showFab() { this.el.fabOverlay?.classList.remove("hidden"); }
  hideFab() { this.el.fabOverlay?.classList.add("hidden"); }
  fabHidden() { return !this.el.fabOverlay || this.el.fabOverlay.classList.contains("hidden"); }

  renderFab(consumables, scrap, job, onPrint) {
    const grid = this.el.fabGrid;
    if (!grid) return;
    if (this.el.fabScrap) this.el.fabScrap.textContent = (scrap | 0).toLocaleString("de-DE");
    // Laufender Druck.
    if (this.el.fabProgress) {
      if (job) {
        const it = FAB_ITEMS[job.id];
        const pct = Math.max(0, Math.min(100, (1 - job.t / job.total) * 100));
        this.el.fabProgress.innerHTML =
          `<div class="fab-job">🖨️ druckt ${it.icon} ${it.name} … ${Math.ceil(job.t)}s` +
          `<div class="fab-bar"><div class="fab-bar-fill" style="width:${pct}%"></div></div></div>`;
      } else {
        this.el.fabProgress.innerHTML = `<div class="fab-job idle">Drucker bereit</div>`;
      }
    }
    grid.innerHTML = "";
    for (const id of FAB_ORDER) {
      const it = FAB_ITEMS[id];
      const have = consumables?.[id] || 0;
      const affordable = !job && scrap >= it.cost;
      const card = document.createElement("div");
      card.className = "skin-card up-card " + (affordable ? "affordable owned" : "locked");
      card.innerHTML =
        `<div class="skin-emoji">${it.icon}</div>` +
        `<div class="skin-name">${it.name}</div>` +
        `<div class="up-desc">${it.desc}</div>` +
        `<div class="skin-status">[${it.slot}] · besitzt ${have} · ${it.cost} 🔩 · ${it.time}s</div>`;
      if (affordable) card.onclick = () => onPrint(id);
      grid.appendChild(card);
    }
  }

  // Verbrauchsgüter-Gürtel im HUD (Slots 1–4 mit Anzahl).
  setBelt(consumables) {
    if (!this.el.belt) return;
    let html = "";
    for (const id of FAB_ORDER) {
      const it = FAB_ITEMS[id];
      const n = consumables?.[id] || 0;
      html += `<span class="belt-item${n > 0 ? " has" : ""}"><b>${it.slot}</b>${it.icon}<i>${n}</i></span>`;
    }
    this.el.belt.innerHTML = html;
  }

  // --- Chip-Sockel (Mainboard-Raster mit Adjazenz) --------------------------
  showChips() { this.el.chipsOverlay?.classList.remove("hidden"); }
  hideChips() { this.el.chipsOverlay?.classList.add("hidden"); }

  // grid = Array(9) aus chipId|null, chips = Zahl, sel = ausgewählter Palette-Typ.
  renderChips(grid, chips, sel, onSlot, onSelect) {
    if (!this.el.chipBoard) return;
    if (this.el.chipBal) this.el.chipBal.textContent = (chips | 0).toLocaleString("de-DE");
    // Raster.
    this.el.chipBoard.innerHTML = "";
    for (let i = 0; i < GRID_N * GRID_N; i++) {
      const id = grid[i];
      const t = id ? CHIP_TYPES[id] : null;
      const cell = document.createElement("button");
      const synced = t && sameNeighbors(grid, i) > 0;
      cell.className = "chip-slot" + (t ? " filled" : " empty") + (synced ? " synced" : "");
      if (t) {
        const hex = "#" + t.color.toString(16).padStart(6, "0");
        cell.style.borderColor = hex;
        cell.style.boxShadow = synced ? `0 0 16px ${hex}` : "none";
        const mult = slotStrength(grid, i);
        cell.innerHTML = `<span class="chip-ico">${t.icon}</span>` + (mult > 1 ? `<span class="chip-mult">×${mult.toFixed(1)}</span>` : "");
        cell.title = t.name + (mult > 1 ? ` (Synergie ×${mult.toFixed(1)})` : "");
      } else {
        cell.textContent = "+";
      }
      cell.onclick = () => onSlot(i);
      this.el.chipBoard.appendChild(cell);
    }
    // Palette.
    this.el.chipPalette.innerHTML = "";
    for (const key of CHIP_ORDER) {
      const t = CHIP_TYPES[key];
      const hex = "#" + t.color.toString(16).padStart(6, "0");
      const b = document.createElement("button");
      b.className = "chip-pal" + (sel === key ? " sel" : "");
      b.style.borderColor = hex;
      b.innerHTML = `<span class="chip-ico">${t.icon}</span><span class="chip-pal-name">${t.name}</span><span class="chip-pal-cost">${t.cost} 🧩</span>`;
      b.onclick = () => onSelect(key);
      this.el.chipPalette.appendChild(b);
    }
  }

  // --- Forschungslabor (Tech-Baum + Story) ----------------------------------
  showResearch() { this.el.researchOverlay?.classList.remove("hidden"); }
  hideResearch() { this.el.researchOverlay?.classList.add("hidden"); }

  // done = { id: true }, data = Zahl, onResearch(id).
  renderResearch(done, data, onResearch) {
    const grid = this.el.researchGrid;
    if (!grid) return;
    if (this.el.researchData) this.el.researchData.textContent = (data | 0).toLocaleString("de-DE");
    grid.innerHTML = "";
    for (const id of RESEARCH_ORDER) {
      const n = RESEARCH[id];
      if (!n) continue;
      const got = !!done[id];
      const avail = !got && researchAvailable(done, id);
      const affordable = avail && data >= n.cost;
      const card = document.createElement("div");
      card.className = "skin-card up-card " + (got ? "equipped" : affordable ? "affordable owned" : "locked");
      const reqTxt = n.req.length ? n.req.map((r) => RESEARCH[r]?.icon || "?").join(" ") + " → " : "";
      const status = got ? "✓ Erforscht" : avail ? `${n.cost.toLocaleString("de-DE")} 📡` : `🔒 ${reqTxt}`.trim();
      card.innerHTML =
        `<div class="skin-emoji">${n.icon}</div>` +
        `<div class="skin-name">${n.name}</div>` +
        `<div class="up-desc">${got ? "entschlüsselt" : "Log-Fragment + Bonus"}</div>` +
        `<div class="skin-status">${status}</div>`;
      if (!got && avail) card.onclick = () => onResearch(id);
      grid.appendChild(card);
    }
  }

  // Story-Fragment groß einblenden (beim Erforschen). Klick schließt.
  showLore(icon, title, text, final = false) {
    if (!this.el.lorePop) return;
    this.el.loreIcon.textContent = icon || "✦";
    this.el.loreTitle.textContent = title || "";
    this.el.loreText.textContent = text || "";
    this.el.loreCard?.classList.toggle("final", !!final);
    this.el.lorePop.classList.remove("hidden");
    const close = () => { this.el.lorePop.classList.add("hidden"); this.el.lorePop.removeEventListener("click", close); };
    this.el.lorePop.addEventListener("click", close);
  }

  // --- Skin-Shop -------------------------------------------------------------
  showSkins() { this.el.skinsOverlay.classList.remove("hidden"); }
  hideSkins() { this.el.skinsOverlay.classList.add("hidden"); }

  // Skins werden per Claude-Rätsel freigeschaltet (kein Preis mehr).
  // riddle = { key, q, options } oder null. onCard(key), onEquip(key), onAnswer(key, optionText).
  renderSkins(meta, riddle, onCard, onEquip, onAnswer) {
    const grid = this.el.skinGrid;
    if (!grid) return;
    if (this.el.skinBalanceLine) this.el.skinBalanceLine.textContent = "Skins durch Claude-Rätsel freischalten 🧠";
    grid.innerHTML = "";
    for (const key of SKIN_ORDER) {
      const def = SKINS[key];
      if (!def) continue;
      const owned = meta.ownedSkins.includes(key);
      const equipped = meta.equippedSkin === key;
      const card = document.createElement("div");
      card.className = "skin-card " + (equipped ? "equipped" : owned ? "owned" : "locked");
      const status = equipped ? "✓ Aktiv" : owned ? "Anlegen" : "🔒 Rätsel";
      card.innerHTML =
        `<div class="skin-emoji">${def.emoji}</div>` +
        `<div class="skin-name">${def.label}</div>` +
        `<div class="skin-status">${status}</div>`;
      if (equipped) { /* aktiv */ }
      else if (owned) card.onclick = () => onEquip(key);
      else card.onclick = () => onCard(key);
      grid.appendChild(card);
    }

    // Rätsel-Bereich (unter dem Grid).
    let r = this.el.skinRiddle;
    if (!r) { r = document.createElement("div"); r.id = "skin-riddle"; grid.parentNode.appendChild(r); this.el.skinRiddle = r; }
    if (riddle) {
      r.style.display = "block";
      const opts = riddle.options.map((o) =>
        `<button class="riddle-opt" data-o="${o.replace(/"/g, "&quot;")}">${o}</button>`).join("");
      r.innerHTML = `<div class="riddle-q">🧠 ${riddle.q}</div><div class="riddle-opts">${opts}</div>`;
      for (const btn of r.querySelectorAll(".riddle-opt")) btn.onclick = () => onAnswer(riddle.key, btn.dataset.o);
    } else {
      r.style.display = "none";
      r.innerHTML = "";
    }
  }

  setScore(v) {
    this.el.score.textContent = "SCORE " + v.toLocaleString("de-DE");
  }

  setWave(n) {
    this.el.wave.textContent = "WAVE " + n;
  }

  setRemaining(n) {
    this.el.remaining.textContent = n > 0 ? "🐛 " + n : "";
  }

  setMeta(text) {
    this.el.metaLine.textContent = text || "";
  }

  // Großes Ziel im Menü: Sektor-Fortschritt (gesäuberte Sektoren des Gebäudes).
  setProgress(cleared = 0, total = 5, won = false) {
    if (this.el.spPips) {
      let pips = "";
      for (let i = 0; i < total; i++) pips += `<span class="sp-pip${i < cleared ? " on" : ""}"></span>`;
      this.el.spPips.innerHTML = pips;
    }
    if (this.el.spLabel) {
      this.el.spLabel.textContent = won
        ? "✅ GEBÄUDE BEFREIT"
        : `GEBÄUDE GESÄUBERT · ${cleared}/${total}`;
      this.el.spLabel.classList.toggle("won", won);
    }
  }

  showVictory(score = 0, wave = 1, kills = 0) {
    if (this.el.victoryScore) this.el.victoryScore.textContent = score.toLocaleString("de-DE");
    if (this.el.victoryWave) this.el.victoryWave.textContent = wave;
    if (this.el.victoryKills) this.el.victoryKills.textContent = kills;
    this.el.victoryOverlay?.classList.remove("hidden");
  }
  hideVictory() { this.el.victoryOverlay?.classList.add("hidden"); }

  // data: { px, pz, half, enemies:[{x,z,boss,bonus}], shop:{x,z} }
  renderMinimap(d) {
    const c = this.el.minimap;
    const ctx = c.getContext("2d");
    const W = c.width, R = W / 2;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = "rgba(14,18,28,0.7)";
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#2c3550"; ctx.lineWidth = 2; ctx.stroke();

    const scale = (R - 8) / Math.max(d.half, 1);
    const plot = (x, z, color, size) => {
      let dx = (x - d.px) * scale, dz = (z - d.pz) * scale;
      const dist = Math.hypot(dx, dz), max = R - 6;
      if (dist > max) { dx *= max / dist; dz *= max / dist; }
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(R + dx, R + dz, size, 0, Math.PI * 2); ctx.fill();
    };
    if (d.shop) plot(d.shop.x, d.shop.z, "#6ee7ff", 3);
    for (const e of d.enemies) {
      plot(e.x, e.z, e.boss ? "#ff8c1a" : e.bonus ? "#ffd23f" : "#ff5470", e.boss ? 4 : 2);
    }
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath(); ctx.arc(R, R, 3.5, 0, Math.PI * 2); ctx.fill();
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

  // CPU-Temperatur: Balkenbreite + Farbe (grün→gelb→rot), Zustände overclock/throttle.
  setHeat(ratio, overclock = false, throttled = false) {
    if (!this.el.heatFill) return;
    const r = Math.max(0, Math.min(1, ratio));
    this.el.heatFill.style.width = (r * 100).toFixed(1) + "%";
    // Farbe: kühl cyan → warm gelb → heiß rot.
    const hue = 190 - r * 190; // 190 (cyan) .. 0 (rot)
    this.el.heatFill.style.background = `hsl(${hue}, 90%, 55%)`;
    if (this.el.heat) {
      this.el.heat.classList.toggle("overclock", overclock);
      this.el.heat.classList.toggle("throttled", throttled);
    }
    if (this.el.heatLabel) {
      this.el.heatLabel.textContent = throttled ? "🔥 ÜBERHITZT" : overclock ? "⚡ OVERCLOCK" : "🌡️ CPU-TEMP";
    }
  }

  banner(main, sub = "") {
    const b = this.el.banner;
    b.innerHTML = sub ? `${main}<span class="sub">${sub}</span>` : main;
    b.classList.add("show");
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => b.classList.remove("show"), 1400);
  }

  // Floating-Text an Bildschirm-Koordinaten (x,y in px).
  popup(x, y, text, color = "#fff", kind = "") {
    // DOM-Spam in dichten Schwärmen vermeiden (kleine Schadenszahlen zuerst droppen).
    const max = kind === "big" ? 60 : 40;
    if (this.el.popups.childElementCount > max) return;
    const d = document.createElement("div");
    d.className = kind ? "popup " + kind : "popup";
    d.textContent = text;
    d.style.left = x + "px";
    d.style.top = y + "px";
    d.style.color = color;
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), kind === "big" ? 900 : 720);
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

  // Boon-Auswahl (1 aus 3). choices: [{icon,name,desc}], onPick(index)
  showBoons(choices, onPick) {
    const cont = this.el.boonCards;
    if (!cont) return;
    cont.innerHTML = "";
    choices.forEach((b, i) => {
      const card = document.createElement("div");
      card.className = "lvl-card boon-card";
      card.innerHTML =
        `<div class="icon">${b.icon}</div>` +
        `<div class="name">${b.name}</div>` +
        `<div class="desc">${b.desc}</div>`;
      card.addEventListener("click", () => onPick(i));
      cont.appendChild(card);
    });
    this.el.boonOverlay?.classList.remove("hidden");
  }
  hideBoons() { this.el.boonOverlay?.classList.add("hidden"); }

  setCoins(n) {
    this.el.coins.textContent = "🪙 " + n;
  }

  // Bau-Ressourcen (Schrott / Chips / Daten) im HUD. 0-Werte werden ausgeblendet,
  // damit die Leiste am Anfang ruhig bleibt.
  setMats(scrap = 0, chips = 0, data = 0) {
    if (!this.el.mats) return;
    const parts = [];
    if (scrap) parts.push("🔩 " + scrap);
    if (chips) parts.push("🧩 " + chips);
    if (data) parts.push("📡 " + data);
    this.el.mats.textContent = parts.join("  ");
  }

  setGadget(text) {
    this.el.gadget.textContent = text || "";
  }

  // Ziel-Anzeige im HUD: aktueller Sektor + nächste Boss-Welle.
  setObjective(text) {
    if (!this.el.objective) return;
    this.el.objective.textContent = text || "";
    this.el.objective.classList.toggle("hidden", !text);
  }

  // Erworbene Run-Boons als kleine Chips (zeigt den aktuellen Build).
  // boons: [{ icon, name }]
  setBoonList(boons = []) {
    if (!this.el.boonbar) return;
    this.el.boonbar.innerHTML = "";
    const count = {};
    for (const b of boons) count[b.icon] = (count[b.icon] || 0) + 1;
    const seen = new Set();
    for (const b of boons) {
      if (seen.has(b.icon)) continue;
      seen.add(b.icon);
      const d = document.createElement("div");
      d.className = "boon-chip";
      d.title = b.name;
      d.innerHTML = `${b.icon}${count[b.icon] > 1 ? `<span class="bx">×${count[b.icon]}</span>` : ""}`;
      this.el.boonbar.appendChild(d);
    }
  }

  toast(icon, title, text) {
    const d = document.createElement("div");
    d.className = "toast";
    d.innerHTML = `<span class="t-ic">${icon}</span><span><b>${title}</b><br>${text}</span>`;
    this.el.toasts.appendChild(d);
    setTimeout(() => {
      d.classList.add("out");
      setTimeout(() => d.remove(), 420);
    }, 3600);
  }

  // buffs: [{ icon, ratio }]
  setBuffs(buffs) {
    this.el.buffs.innerHTML = "";
    for (const b of buffs) {
      const d = document.createElement("div");
      d.className = "buff";
      d.textContent = b.icon;
      d.style.opacity = String(0.45 + 0.55 * b.ratio);
      this.el.buffs.appendChild(d);
    }
  }

  showPrompt(text) {
    this.el.prompt.textContent = text;
    this.el.prompt.classList.remove("hidden");
  }

  hidePrompt() {
    this.el.prompt.classList.add("hidden");
  }

  // Rubber-Duck-Guide: Sprechblase der Mentor-Ente.
  showGuide(text) {
    if (!this.el.guide) return;
    this.el.guideText.textContent = text;
    this.el.guide.classList.remove("hidden");
  }
  hideGuide() {
    if (this.el.guide) this.el.guide.classList.add("hidden");
  }

  showShop() { this.el.shopOverlay.classList.remove("hidden"); }
  hideShop() { this.el.shopOverlay.classList.add("hidden"); }

  showBossIntro(name) {
    this.el.cwBugName.textContent = name;
    this.el.bossIntro.classList.remove("hidden");
  }
  hideBossIntro() { this.el.bossIntro.classList.add("hidden"); }

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

  showGameOver(score, wave, highscore = 0, kills = 0) {
    this.el.finalScore.textContent = score.toLocaleString("de-DE");
    this.el.finalWave.textContent = wave;
    this.el.finalKills.textContent = kills;
    this.el.finalHi.textContent = highscore.toLocaleString("de-DE");
    this.el.over.classList.remove("hidden");
  }
}
