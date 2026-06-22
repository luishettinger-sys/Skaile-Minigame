// Game-Orchestrator: verbindet alle Systeme und hält den Spielzustand.
// Roguelite-Survivor: Maus-Zielen, Waffen, Wellen, Combo, Ultimate,
// XP/Level-Ups (Fähigkeiten ODER Waffenwechsel), Pickups, Boss.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { Player } from "./player.js";
import { ProjectileSystem } from "./projectiles.js";
import { EnemySystem, edgeSpawn } from "./enemies.js";
import { Effects } from "./effects.js";
import { WaveManager } from "./waves.js";
import { Guide } from "./guide.js";
import { Progression } from "./progression.js";
import { PickupSystem } from "./pickups.js";
import { WEAPONS, WEAPON_IDS, WEAPON_PRICE, WEAPON_LEVEL } from "./weapons.js";
import { Armory } from "./armory.js";
import { cloneWeaponModel } from "./weaponmodels.js";
import { Automation } from "./automation.js";
import { Inventory } from "./inventory.js";
import { Stations } from "./stations.js";
import { Gate } from "./gate.js";
import { EnemyShots } from "./enemyshots.js";
import { Throwables } from "./throwables.js";
import { rollItem, defaultMods, mergeMods } from "./items.js";
import { FORGE_MODS, FORGE_ORDER, forgeCost } from "./forge.js";
import { RESEARCH, RESEARCH_ORDER, researchAvailable, researchMods, researchDropMult } from "./research.js";
import { CHIP_TYPES, CHIP_ORDER, chipMods, chipFlags, normalizeGrid } from "./chips.js";
import { FAB_ITEMS, FAB_ORDER, fabBySlot } from "./fabricator.js";
import { SECTOR_MODS, rollSectorMod, DRAFTS, rollDrafts } from "./anomalies.js";
import { POWERUPS, POWER_IDS, TIMED_IDS } from "./powerups.js";
import { GADGETS, GADGET_IDS, gadgetPrice } from "./gadgets.js";
import { SKINS, SKIN_RIDDLES } from "./skins.js";
import { META_UPGRADES, META_ORDER, metaPrice, metaMods, metaStartCoins } from "./metaupgrades.js";
import { BOONS, rollBoons } from "./boons.js";
import { Achievements } from "./achievements.js";
import { STORY, Cutscene } from "./story.js";
import { IntroChat } from "./introchat.js";
import { distXZ, clamp, angleLerp } from "./utils.js";

const STATE = { MENU: "menu", PLAYING: "playing", OVER: "over", WON: "won" };
const HISCORE_KEY = "duckdebug_highscore";

// Witz-Flavor: zwischen Wellen & gelegentlich eingeblendet.
const PATCH_NOTES = [
  "v1.3 – Stack Overflow's Lunge generft 😈",
  "v1.4 – Heisenbug existiert jetzt nur, wenn man hinschaut",
  "v1.5 – Race Condition spawnt jetzt deterministisch (lol)",
  "v1.6 – Memory Leak leakt jetzt 12 % effizienter",
  "v1.7 – Null Pointer zeigt endlich irgendwohin",
  "v2.0 – 'Works on my machine' offiziell unterstützt",
];
const DUCK_TIPS = [
  "Schon mal aus- und wieder eingeschaltet? 🦆",
  "Erklär den Bug der Ente – dann siehst du ihn.",
  "Tipp: Dash (Shift) hat i-Frames.",
  "Wirf was mit F auf die Viecher!",
  "Combo halten = mehr Score & schnelleres Ultimate.",
  "Kauf dir am Stand Raketenstiefel (G zum Wechseln).",
];

export class Game {
  constructor({ world, input, hud, audio }) {
    this.world = world;
    this.input = input;
    this.hud = hud;
    this.audio = audio;
    this.guide = new Guide(hud); // Rubber-Duck-Mentor

    this.player = new Player(world.scene);
    this.projectiles = new ProjectileSystem(world.scene);
    this.enemies = new EnemySystem(world.scene);
    this.effects = new Effects(world.scene);
    this.pickups = new PickupSystem(world.scene);
    this.progression = new Progression();

    this.inventory = new Inventory();
    this.stations = new Stations(world.scene);
    // Verteidigungs-Tor am Nord-Durchgang (schützt den PC). Feste Kollisionswand,
    // damit Monster nicht durchlaufen – sie müssen es erst zerstören.
    this.gate = new Gate(world.scene, 0, -28, { maxHp: 320, width: 11 });
    this._gateWall = { minX: -5.5, maxX: 5.5, minZ: -29.2, maxZ: -26.8 };
    world.building?.walls?.push(this._gateWall);
    // Der PC hinter dem Tor – das eigentliche Schutzziel. Erst wenn DER zerstört
    // ist, ist der Run vorbei. Das Tor ist nur der Zeitpuffer davor.
    this.pc = {
      x: 0, z: -45, r: 4.8, maxHp: 220, hp: 220, alive: true,
      damage(a) { if (this.hp <= 0) return false; this.hp = Math.max(0, this.hp - a); this.alive = this.hp > 0; return this.hp <= 0; },
    };
    this.enemyShots = new EnemyShots(world.scene);
    this.throwables = new Throwables(world.scene);
    this.armory = new Armory(world.scene, world.building?.rooms?.armory);
    this.automation = new Automation(world.scene, world.building?.rooms?.lab);

    // Story-Cutscenes (Intro / Sektor-Zwischenszenen / Finale).
    this.cutscene = new Cutscene(document.getElementById("cutscene"));
    this.introChat = new IntroChat(document.getElementById("intro-chat"));
    this.cutsceneActive = false;
    this._introSeen = false;        // Intro nur einmal pro Sitzung
    this._seenSectorCS = new Set(); // jede Sektor-Szene einmal pro Sitzung

    // Höhen-Sampling (Plattformen) an Spieler & Gegner geben.
    this.player.terrain = world.terrain;
    this.enemies.terrain = world.terrain;

    this.waves = new WaveManager({
      onSpawn: (type) => this._spawnEnemy(type),
      onWaveStart: (n) => this._onWaveStart(n),
      onWaveClear: (n) => this._onWaveClear(n),
    });

    this.achievements = new Achievements();
    this.highscore = Number(localStorage.getItem(HISCORE_KEY)) || 0;
    this.meta = this._loadMeta();
    // Dauerhaft gekaufte Räume öffnen (Basis waechst über Runs hinweg).
    this.world.building?.applyUnlocked?.(this.meta.unlockedRooms);
    this._showMetaLine();
    this.state = STATE.MENU;
    this._resetRun();
  }

  _loadMeta() {
    const def = { coins: 0, bestWave: 1, kills: 0, ownedSkins: ["classic"], equippedSkin: "classic", upgrades: {}, sectorsCleared: 0, won: false, unlockedRooms: [], guideSeen: false, data: 0, research: {}, craftedMods: {}, chipGrid: [], tutSeen: {} };
    let m;
    try { m = JSON.parse(localStorage.getItem("duckdebug_meta")) || {}; }
    catch (e) { m = {}; }
    m = { ...def, ...m };
    if (!Array.isArray(m.ownedSkins) || !m.ownedSkins.includes("classic")) m.ownedSkins = ["classic", ...(m.ownedSkins || []).filter((k) => k !== "classic")];
    if (!SKINS[m.equippedSkin] || !m.ownedSkins.includes(m.equippedSkin)) m.equippedSkin = "classic";
    // Meta-Upgrades sanitisieren (nur bekannte Keys, auf Max begrenzt).
    if (!m.upgrades || typeof m.upgrades !== "object") m.upgrades = {};
    for (const key in m.upgrades) {
      if (!META_UPGRADES[key]) { delete m.upgrades[key]; continue; }
      m.upgrades[key] = Math.max(0, Math.min(META_UPGRADES[key].max, m.upgrades[key] | 0));
    }
    m.sectorsCleared = Math.max(0, Math.min(CONFIG.campaign.sectors, m.sectorsCleared | 0));
    m.won = !!m.won;
    if (!Array.isArray(m.unlockedRooms)) m.unlockedRooms = [];
    // Bau-System: Daten (permanent), Forschungs-Level, gebaute Mods, Chip-Raster.
    m.data = Math.max(0, m.data | 0);
    if (!m.research || typeof m.research !== "object") m.research = {};
    if (!m.craftedMods || typeof m.craftedMods !== "object" || Array.isArray(m.craftedMods)) m.craftedMods = {};
    for (const k in m.craftedMods) {
      if (!FORGE_MODS[k]) { delete m.craftedMods[k]; continue; }
      m.craftedMods[k] = Math.max(0, Math.min(FORGE_MODS[k].max, m.craftedMods[k] | 0));
    }
    m.chipGrid = normalizeGrid(m.chipGrid);
    if (!m.tutSeen || typeof m.tutSeen !== "object") m.tutSeen = {};
    return m;
  }

  _saveMeta() {
    localStorage.setItem("duckdebug_meta", JSON.stringify(this.meta));
  }

  // --- Skin-Shop (dauerhafte Kosmetik) ---------------------------------------
  // mode "bank" = aus der Bank (meta.coins, Menü/Pause/Game-Over),
  // mode "run"  = aus den Run-Coins (Bug-Markt am Stand).
  openSkins(mode = "bank") {
    this._skinMode = mode === "run" ? "run" : "bank";
    this._renderSkins();
    this.hud.showSkins();
  }
  closeSkins() { this.hud.hideSkins(); }

  _renderSkins() {
    this.hud.renderSkins(this.meta, this._skinRiddle, (k) => this._onSkinCard(k), (k) => this.equipSkin(k), (k, opt) => this._answerSkinRiddle(k, opt));
  }

  // Klick auf eine Skin-Karte: besessen → anlegen, sonst Claude-Rätsel öffnen.
  _onSkinCard(key) {
    if (this.meta.ownedSkins.includes(key)) { this.equipSkin(key); return; }
    const r = SKIN_RIDDLES[key];
    if (!r) return;
    const options = [...r.options].sort(() => Math.random() - 0.5); // mischen
    this._skinRiddle = { key, q: r.q, options };
    this._renderSkins();
  }

  // Rätsel beantwortet: richtig → Skin freischalten + anlegen; falsch → Hinweis.
  _answerSkinRiddle(key, chosen) {
    const r = SKIN_RIDDLES[key];
    this._skinRiddle = null;
    if (r && chosen === r.answer) {
      if (!this.meta.ownedSkins.includes(key)) { this.meta.ownedSkins.push(key); this._saveMeta(); }
      this.audio.levelUp?.();
      this.hud.toast?.("✅", "Richtig!", (SKINS[key]?.label || "Skin") + " freigeschaltet");
      this.equipSkin(key);
    } else {
      this.audio.playerHurt?.();
      this.hud.toast?.("❌", "Leider falsch", "Versuch's nochmal");
      this._renderSkins();
    }
  }

  equipSkin(key) {
    if (!this.meta.ownedSkins.includes(key)) return;
    this.meta.equippedSkin = key;
    this._saveMeta();
    this.applyEquippedSkin();
    this._showMetaLine();
    this._renderSkins();
  }

  applyEquippedSkin() {
    this.player.setSkin(SKINS[this.meta.equippedSkin] || SKINS.classic);
  }

  _showMetaLine() {
    const m = this.meta;
    this.hud.setMeta(`Bank: ${m.coins.toLocaleString("de-DE")} 🪙 · Beste Welle ${m.bestWave} · ${m.kills.toLocaleString("de-DE")} Bugs gekillt`);
    this._showProgress();
  }

  // Großes Ziel im Menü: wie viele Sektoren des Gebäudes schon gesäubert sind.
  _showProgress() {
    this.hud.setProgress(this.meta.sectorsCleared, CONFIG.campaign.sectors, this.meta.won);
  }

  // --- Lab-Ausbau (permanente Meta-Upgrades, aus der Bank) -------------------
  openUpgrades() {
    this._renderUpgrades();
    this.hud.showUpgrades();
  }
  closeUpgrades() { this.hud.hideUpgrades(); }

  _renderUpgrades() {
    this.hud.renderUpgrades(this.meta, (k) => this.buyUpgrade(k));
  }

  // Loot-Multiplikatoren = Forschung × aktive Sektor-Anomalie.
  _computeDropMult() {
    const base = researchDropMult(this.meta.research || {});
    const lm = this.sectorMod?.lootMult || 1;
    return { scrap: base.scrap * lm, data: base.data * lm };
  }

  // --- BOSS-PHASEN: Bosse eskalieren mit sinkender HP (epische Mehrphasen-Kämpfe).
  // Phase 1 (>66%), Phase 2 (33–66%), Phase 3 (<33% = Enrage). Beim Phasenwechsel
  // dramatisches Feedback + ein Arena-Gimmick (Adds, Bullet-Nova, Gift-Ring).
  _checkBossPhase(frac) {
    const want = frac <= 0.33 ? 3 : frac <= 0.66 ? 2 : 1;
    if (want <= (this._bossPhase || 1)) return;
    this._bossPhase = want;
    const b = this.boss;
    if (b) b.phaseLevel = want; // enemies.js liest das für schnellere/dichtere Angriffe
    this.audio.bossAppear?.();
    this.world.addShake(0.8);
    this._freeze(0.12);
    this.hud.flash("#ff2a3a", 0.5);
    this.hud.banner(want === 3 ? "💢 ENRAGE – PHASE 3" : "⚠️ PHASE " + want, b?.def.label || "BOSS");
    this._bossGimmick(want);
  }

  // Arena-Gimmick beim Phasenwechsel: macht jeden Boss-Kampf wuchtig & eigen.
  _bossGimmick(phase) {
    const b = this.boss; if (!b) return;
    const bx = b.mesh.position.x, bz = b.mesh.position.z;
    const half = this.world.arenaHalf;
    // Telegrafierte Schockwelle vom Boss (Ring, gut sichtbar).
    this.effects.shockwave(bx, bz, b.def.glow || 0xff3b52, 18, 24);
    // Phase 2: ein paar Adds beschwören. Phase 3: Gift-Ring am Arena-Rand.
    if (phase === 2) {
      for (let k = 0; k < 4; k++) {
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 8;
        this.enemies.spawn("syntax", bx + Math.cos(a) * r, bz + Math.sin(a) * r);
      }
      this.hud.toast?.("👾", "Adds!", "Der Boss ruft Verstärkung");
    } else if (phase === 3) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        this.enemies.spawnHazard?.(Math.cos(a) * (half - 2), Math.sin(a) * (half - 2));
      }
      this.hud.toast?.("☢️", "Der Rand brennt!", "Bleib in der Mitte");
    }
  }

  // --- ROGUELITE: Sektor-Anomalien -----------------------------------------
  // Beim Betreten eines neuen Sektors greift ein zufälliger Modifikator, der den
  // Run verändert (Loot/Schaden/Hitze/HP). Jeder Durchlauf fühlt sich anders an.
  _applySectorMod(sector) {
    const mod = rollSectorMod(this._lastSectorModId);
    this._lastSectorModId = mod.id;
    this.sectorMod = mod;
    this.sectorMods = mod.mods ? mergeMods(defaultMods(), mod.mods) : defaultMods();
    this._sectorHeatGain = mod.heatGainMult || 1;
    this._sectorHeatCool = mod.heatCoolMult || 1;
    this._sectorCoinMult = mod.coinMult || 1;
    this._dropMult = this._computeDropMult();
    this._recomputeMods();
    this._syncStats();
    this.hud.setHp?.(this.player.hp, this.player.maxHp);
    this.hud.banner("🌐 SEKTOR " + sector + " – ANOMALIE", mod.icon + " " + mod.name);
    this.hud.toast?.(mod.icon, mod.name, mod.desc);
    this.world.addShake(0.2);
    this._updateObjective(this.waves?.wave || 1); // Anomalie in der Ziel-Zeile zeigen
  }

  // --- ROGUELITE: Run-Start-Draft (Build wählen) ----------------------------
  // Nach Welle 1: Auswahl aus 3 Schwertern (löst die Fäuste ab).
  _offerDraft() {
    this.draftChoosing = true;
    this.audio.levelUp?.();
    this._draftChoices = [
      { weapon: "sword", icon: "⚔️", name: "Schwert", desc: "Halbkreis-Flächenschaden, kurze Reichweite" },
      { weapon: "sword_fire", icon: "🔥", name: "Feuerschwert", desc: "Setzt Bugs in Brand (Schaden über Zeit)" },
      { weapon: "sword_ice", icon: "❄️", name: "Eisschwert", desc: "Friert Bugs an – verlangsamt sie stark" },
    ];
    this.hud.showDraft(this._draftChoices, (i) => this._pickDraft(i));
  }

  _pickDraft(i) {
    const c = this._draftChoices?.[i];
    if (!c) return;
    if (c.weapon && WEAPONS[c.weapon]) {
      this._setWeapon(c.weapon);
    }
    if (c.mods) this.draftMods = mergeMods(defaultMods(), c.mods);
    this._recomputeMods();
    this._syncStats();
    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.audio.buy?.();
    this.hud.banner("🎮 BUILD", c.icon + " " + c.name);
    this.world.addShake(0.2);
    this.draftChoosing = false;
    this._draftPending = false;
    this.hud.hideDraft();
    // Kein Deploy-Terminal mehr: sobald der Build gewählt ist, starten die Wellen automatisch.
    if (!this.defenseLoop) this.startDefense();
  }

  // --- SCHMIEDE (Ost): Waffen-Mods aus Schrott bauen -----------------------
  openForge() {
    this._renderForge();
    this.hud.showForge();
  }
  closeForge() { this.hud.hideForge(); }

  _renderForge() {
    this.hud.renderForge(this.meta.craftedMods, this.mats.scrap, (id) => this.craftMod(id));
  }

  craftMod(id) {
    const def = FORGE_MODS[id];
    if (!def) return;
    const lvl = (this.meta.craftedMods[id] || 0) | 0;
    if (lvl >= def.max) { this.hud.toast?.("✅", "Voll gebaut", def.name); return; }
    const cost = forgeCost(id, lvl);
    if (this.mats.scrap < cost) { this.hud.toast?.("🔩", "Nicht genug Schrott", `${def.name} kostet ${cost} 🔩`); this.audio.playerHurt?.(); return; }
    this.mats.scrap -= cost;
    this.meta.craftedMods[id] = lvl + 1;
    this._saveMeta();
    this.audio.buy?.();
    this.world.addShake(0.1);
    this._recomputeMods();
    this._syncStats();
    this._matsDirty = true;
    this._renderForge();
    this.hud.toast?.(def.icon, def.name + " Lv." + (lvl + 1), def.desc(lvl + 1));
  }

  // --- FORSCHUNGSLABOR (Süd): Daten -> Tech-Baum + Story-Fragmente -----------
  openResearch() {
    this._renderResearch();
    this.hud.showResearch();
  }
  closeResearch() { this.hud.hideResearch(); }

  _renderResearch() {
    this.hud.renderResearch(this.meta.research || {}, this.meta.data | 0, (id) => this.doResearch(id));
  }

  doResearch(id) {
    const n = RESEARCH[id];
    if (!n) return;
    const done = this.meta.research || (this.meta.research = {});
    if (done[id]) return;
    if (!researchAvailable(done, id)) { this.hud.toast?.("🔒", "Gesperrt", "Erst Voraussetzungen erforschen"); return; }
    if ((this.meta.data | 0) < n.cost) { this.hud.toast?.("📡", "Nicht genug Daten", `${n.name} kostet ${n.cost} 📡`); this.audio.playerHurt?.(); return; }
    this.meta.data -= n.cost;
    done[id] = true;
    this._saveMeta();
    this.audio.levelUp?.();
    this.world.addShake(0.12);
    this._recomputeMods();
    this._syncStats();
    this._dropMult = researchDropMult(done);
    this._matsDirty = true;
    this._renderResearch();
    // Log-Fragment enthüllen: der "höhere Sinn" tropft hier Stück für Stück rein.
    this.hud.showLore(n.icon, n.name, n.lore, !!n.effect.final);
  }

  // --- CHIP-SOCKEL (Nord): Mainboard-Raster mit Adjazenz-Boni ---------------
  openChips() {
    this._chipSel = this._chipSel || CHIP_ORDER[0];
    this._renderChips();
    this.hud.showChips();
  }
  closeChips() { this.hud.hideChips(); }

  _renderChips() {
    this.hud.renderChips(
      this.meta.chipGrid, this.mats.chips, this._chipSel,
      (idx) => this.placeOrRemoveChip(idx),
      (type) => { this._chipSel = type; this._renderChips(); }
    );
  }

  // Klick auf einen Slot: leer -> ausgewählten Chip setzen (kostet 🧩);
  // belegt -> Chip entfernen (halbe Rückerstattung).
  placeOrRemoveChip(idx) {
    const grid = this.meta.chipGrid;
    if (grid[idx]) {
      const t = CHIP_TYPES[grid[idx]];
      grid[idx] = null;
      const refund = Math.floor((t?.cost || 0) / 2);
      this.mats.chips += refund;
      this.audio.pickup?.();
    } else {
      const t = CHIP_TYPES[this._chipSel];
      if (!t) return;
      if (this.mats.chips < t.cost) { this.hud.toast?.("🧩", "Nicht genug Chips", `${t.name} kostet ${t.cost} 🧩`); this.audio.playerHurt?.(); return; }
      this.mats.chips -= t.cost;
      grid[idx] = this._chipSel;
      this.audio.buy?.();
      this.world.addShake(0.06);
    }
    this._saveMeta();
    this._chipFlags = chipFlags(grid);
    this._recomputeMods();
    this._syncStats();
    this._matsDirty = true;
    this._renderChips();
  }

  // --- FABRIKATOR (West): Verbrauchsgüter aus Schrott drucken ----------------
  openFab() {
    this._renderFab();
    this.hud.showFab();
  }
  closeFab() { this.hud.hideFab(); }

  _renderFab() {
    this.hud.renderFab(this.consumables, this.mats.scrap, this._printJob, (id) => this.startPrint(id));
  }

  startPrint(id) {
    const it = FAB_ITEMS[id];
    if (!it) return;
    if (this._printJob) { this.hud.toast?.("🖨️", "Drucker belegt", "Erst aktuellen Druck abwarten"); return; }
    if (this.mats.scrap < it.cost) { this.hud.toast?.("🔩", "Nicht genug Schrott", `${it.name} kostet ${it.cost} 🔩`); this.audio.playerHurt?.(); return; }
    this.mats.scrap -= it.cost;
    this._printJob = { id, t: it.time, total: it.time };
    this.audio.buy?.();
    this._matsDirty = true;
    this._renderFab();
  }

  // Druckfortschritt (läuft auch während Wellen weiter). Fertig → Gürtel + Toast.
  _updatePrint(dt) {
    const j = this._printJob;
    if (!j) return;
    j.t -= dt;
    if (j.t <= 0) {
      const it = FAB_ITEMS[j.id];
      this.consumables[j.id] = (this.consumables[j.id] || 0) + 1;
      this._printJob = null;
      this.audio.levelUp?.();
      this.hud.toast?.(it.icon, "Druck fertig", `${it.name} → [${it.slot}]`);
      this.hud.setBelt?.(this.consumables);
      if (!this.hud.fabHidden?.()) this._renderFab();
    }
  }

  // Verbrauchsgut aus Gürtel-Slot (1–4) zünden.
  useConsumable(slot) {
    const id = fabBySlot(slot);
    if (!id || !this.consumables[id]) return;
    this.consumables[id]--;
    const it = FAB_ITEMS[id];
    if (id === "cool") {
      this.heat = 0; this.throttled = false;
      this.hud.flash?.("#9bd0ff", 0.3);
      this.hud.banner?.("❄️ KÜHL-SPRAY", "CPU auf 0°");
    } else if (id === "heal") {
      this._activatePower("heal");
    } else if (id === "shield") {
      this._activatePower("shield");
    } else if (id === "purge") {
      this._activatePower("nuke");
    }
    this.audio.pickup?.();
    this.hud.setBelt?.(this.consumables);
    if (!this.hud.fabHidden?.()) this._renderFab();
  }

  buyUpgrade(key) {
    const def = META_UPGRADES[key];
    if (!def) return;
    const lvl = this.meta.upgrades[key] || 0;
    if (lvl >= def.max) { this.hud.toast?.("✅", "Voll ausgebaut", def.name); return; }
    const price = metaPrice(def, lvl);
    if (this.meta.coins < price) { this.hud.toast?.("🪙", "Nicht genug Bank", `${def.name} kostet ${price}`); return; }
    this.meta.coins -= price;
    this.meta.upgrades[key] = lvl + 1;
    this._saveMeta();
    this.audio.buy();
    // Wirkt sofort (falls im Pause-Menü gekauft) – beim Run-Start ohnehin neu.
    this._recomputeMods();
    this._syncStats();
    this._showMetaLine();
    this._renderUpgrades();
  }

  // Mods aus den permanenten Meta-Upgrades.
  _metaMods() { return metaMods(this.meta.upgrades); }

  // Run-Coins zu Beginn aus dem Startkapital-Ausbau.
  _startCoins() { return metaStartCoins(this.meta.upgrades); }

  // Waffe + additive/multiplikative Upgrade-Modifikatoren.
  _initLoadout() {
    this.weaponId = "fists";
    this.weapon = WEAPONS.fists;
    this.upgradeMods = defaultMods(); // aus Level-Up-Upgrades
    this.equipMods = defaultMods(); // aus ausgerüsteten Items
    this._recomputeMods();
    this._refreshHeldWeapon();
    this.player.setMeleeVisual?.("fists", WEAPONS.fists.color); // Start mit sichtbaren Fäusten
  }

  // Effektive Mods = Upgrades kombiniert mit Ausrüstung.
  _recomputeMods() {
    const m = defaultMods();
    mergeMods(m, this._metaMods()); // permanente Lab-Ausbauten zuerst
    mergeMods(m, researchMods(this.meta.research || {})); // Forschungs-Boni (Daten)
    mergeMods(m, chipMods(this.meta.chipGrid || [])); // Chip-Sockel-Boni (Chips)
    mergeMods(m, this._craftMods()); // permanente Schmiede-Mods (Schrott)
    if (this.sectorMods) mergeMods(m, this.sectorMods); // Sektor-Anomalie (Run)
    if (this.draftMods) mergeMods(m, this.draftMods); // Run-Start-Draft
    mergeMods(m, this.boonMods); // Run-Boons
    mergeMods(m, this.upgradeMods);
    mergeMods(m, this.equipMods);
    mergeMods(m, this._gadgetMods());
    this.mods = m;
  }

  // Aggregierte Mods aus den in der Schmiede gebauten Stufen (permanent).
  _craftMods() {
    const m = defaultMods();
    const crafted = this.meta.craftedMods || {};
    for (const id in crafted) {
      const lvl = crafted[id] | 0;
      if (lvl > 0 && FORGE_MODS[id]) mergeMods(m, FORGE_MODS[id].per(lvl));
    }
    return m;
  }

  // Boni des aktuell aktiven Gadgets (nur eins gleichzeitig).
  _gadgetMods() {
    const m = defaultMods();
    const id = this.activeGadget;
    if (id && this.gadgets[id] > 0) GADGETS[id].apply(m, this.gadgets[id]);
    return m;
  }

  buyGadget(id) {
    this.gadgets[id] = (this.gadgets[id] || 0) + 1;
    if (!this.activeGadget) this.activeGadget = id;
    this._recomputeMods();
    this._syncStats();
    this.player.setGadget(GADGETS[this.activeGadget].icon);
    this.hud.setGadget(this._gadgetLabel());
  }

  _gadgetLabel() {
    const id = this.activeGadget;
    return id ? GADGETS[id].icon + " Lv" + this.gadgets[id] : "";
  }

  // Aktives Gadget durchschalten (Taste G).
  cycleGadget() {
    const owned = GADGET_IDS.filter((id) => this.gadgets[id] > 0);
    if (owned.length === 0) return;
    const cur = owned.indexOf(this.activeGadget);
    this.activeGadget = owned[(cur + 1) % owned.length];
    this._recomputeMods();
    this._syncStats();
    this.player.setGadget(GADGETS[this.activeGadget].icon);
    this.hud.setGadget(this._gadgetLabel());
    this.hud.banner("GADGET", GADGETS[this.activeGadget].icon + " " + GADGETS[this.activeGadget].name);
  }

  // Ausrüstung neu berechnen und anwenden (nach Equip/Unequip).
  _applyEquipment() {
    this.equipMods = this.inventory.computeMods();
    this._recomputeMods();
    this._syncStats();
  }

  // Effektive Kampfwerte aus Waffe + Mods.
  _fireInterval() {
    const H = CONFIG.heat;
    const oc = this.overclock ? H.ocFireMult : 1;
    const th = this.throttled ? H.throttleFireMult : 1;
    return this.weapon.fireInterval * this.mods.fireMult * (this.buffs.rapid > 0 ? 0.5 : 1) * oc * th;
  }
  _damage() {
    const oc = this.overclock ? CONFIG.heat.ocDmgMult : 1;
    return (this.weapon.damage + this.mods.dmgAdd) * this.mods.dmgMult * (this.buffs.double > 0 ? 2 : 1) * oc;
  }
  _projCount() { return this.weapon.projCount + this.mods.projAdd; }
  _pierce() { return this.weapon.pierce + this.mods.pierceAdd; }
  _projScale() { return this.weapon.projScale * this.mods.projScaleMult; }
  _moveSpeed() { return CONFIG.player.speed * this.mods.moveSpeedMult; }
  _magnet() {
    const collector = 1 + (this.automation?.levels.collector || 0) * 0.6;
    return CONFIG.pickups.magnet * this.mods.magnetMult * collector * (this.magnetBoost > 0 ? 8 : 1);
  }
  _maxHp() { return Math.max(10, CONFIG.player.maxHp + this.mods.maxHpAdd); }
  _dashCd() { return CONFIG.player.dash.cooldown * this.mods.dashCdMult; }

  _resetRun() {
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboMult = 1;
    this.fireTimer = 0;
    this.ultCharge = 0;
    this.ultReady = false;
    this.ultActive = false;
    this.ultTimer = 0;
    this.paused = false;
    this.levelingUp = false;
    this.pendingLevels = 0;
    this.boss = null;
    this.energy = CONFIG.energy.max;
    this.sinceShot = 99; // Sekunden seit letztem Schuss (für Regen-Delay)
    this.hitStop = 0; // kurzes Einfrieren (Impact)
    this.autoCamT = 0; // Timer für automatische Perspektivwechsel
    this.camRevert = 0; // verbleibende Zeit bis Kamera zurücksetzt
    this.invOpen = false;
    this.shopOpen = false;
    this.shopOffers = [];
    this.coins = this._startCoins(); // Startkapital aus permanentem Ausbau
    // Bau-Ressourcen: Schrott + Chips sind run-basiert (droppen aus Bugs);
    // Daten sind permanent (Forschungslabor) und liegen in meta.
    this.mats = { scrap: 0, chips: 0 };
    this._matsDirty = true;
    this._chipFlags = chipFlags(this.meta.chipGrid || []); // Heatsink-Abkühlung etc.
    // Roguelite: Sektor-Anomalien (pro Sektor 1 Modifikator) + Run-Start-Draft.
    this.sectorMods = defaultMods();
    this.sectorMod = null;
    this._activeSector = 0;
    this._lastSectorModId = null;
    this._sectorHeatGain = 1;
    this._sectorHeatCool = 1;
    this._sectorCoinMult = 1;
    this.draftMods = defaultMods();
    this.draftChoosing = false;
    this._draftPending = false; // kein Start-Draft mehr: Start mit Fäusten
    this._autoStarted = false;  // Wellen starten automatisch nach dem Intro
    this._swordChosen = false;  // Schwert-Wahl wird nach Welle 1 angeboten
    this._dropMult = this._computeDropMult(); // Forschung × Sektor-Loot
    // Fabrikator: Verbrauchsgüter-Gürtel + laufender Druckauftrag (run-basiert).
    this.consumables = { heal: 0, shield: 0, cool: 0, purge: 0 };
    this._printJob = null; // { id, t, total }
    this.hud.setBelt?.(this.consumables);
    // CPU-Temperatur (Signatur-Mechanik).
    this.heat = 0;
    this.overclock = false;
    this.throttled = false;
    this._heatWarned = false;
    this.bossIntro = false;
    this.intro = null;
    this.buffs = { rapid: 0, double: 0, shield: 0, slow: 0 };
    this.gadgets = {}; // id -> Stufe
    this.activeGadget = null;
    this.carrying = null; // aktuell getragenes Wurfobjekt
    this.bonusT = 22; // Timer bis zum nächsten Bonus-Bug
    this._throwT = 12; // Timer bis zur nächsten Granate
    this.tipT = 14; // Timer bis zum nächsten Rubber-Duck-Tipp
    this.magnetBoost = 0; // Sekunden Riesen-Magnet (nach Level-Up)
    this.autoTntT = 6; // Timer bis zum nächsten automatischen TNT-Wurf
    this.won = false; // Sieg in diesem Run schon erreicht?
    this._banked = false; // Run-Coins schon in die Bank gebucht? (gegen Doppelung)
    // Roguelite-Boons (run-only, stapelbar): Mods + Sonder-Flags.
    this.boons = [];
    this.boonMods = defaultMods();
    this.boonFlags = { lifesteal: 0, coinMult: 1 };
    this.boonChoosing = false;
    this.boonPending = false;
    this.runStats = { kills: 0, bossKills: 0, bonus: 0, maxCombo: 0, wave: 1 };
    this.inventory.reset();
    this.progression.reset();
    this._initLoadout();
  }

  _freeze(t) {
    this.hitStop = Math.max(this.hitStop, t);
  }

  start() {
    this._resetRun();
    this.player.reset();
    this.projectiles.reset();
    this.enemies.reset();
    this.effects.reset();
    this.pickups.reset();
    this.stations.reset();
    this.gate?.reset();
    this._gateCost = 40;
    this._gateBreached = false;
    this._pcHpPrev = undefined;
    if (this._gateWall && this.world.building?.walls && !this.world.building.walls.includes(this._gateWall)) {
      this.world.building.walls.push(this._gateWall);
    }
    if (this.pc) { this.pc.hp = this.pc.maxHp; this.pc.alive = true; }
    this.respawning = false;
    this.respawnT = 0;
    this.enemyShots.reset();
    this.throwables.reset();
    this.carrying = null;
    this.waves.reset();
    this.defenseLoop = false; // Wellen sind opt-in: erst per Deploy-Terminal starten
    this._gatesWereOpen = true;
    this.world.building?.setGatesOpen?.(true); // im Bau-Modus alle Räume offen
    this._challengeActive = false; this._challengeCD = 0; this._challengeTimer = 0;
    this._aimHold = 0; // Rest-Zeit, in der die Ente zum Gegner blickt (nach Schuss)
    this.automation.reset();
    this.audio.init();
    this.audio.resume();
    this.audio.startMusic();
    this._syncStats();

    this.hud.hideOverlays();
    this.hud.hidePause();
    this.hud.hideLevelUp();
    this.hud.hideBoss();
    this.hud.setScore(0);
    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.hud.setUltimate(0, false);
    this.hud.setCombo(1);
    this.hud.setXp(0, 1);
    this.hud.setWeapon(this.weapon.name, this.weapon.icon);
    this.hud.setEnergy(1);
    this.hud.setVignette(0);
    this.hud.setCoins(this.coins);
    this.hud.setBuffs([]);
    this.hud.setBoonList([]);
    this._updateObjective(1);
    this.hud.setGadget("");
    this.player.setGadget(null);
    this.hud.hidePrompt();
    this.hud.hideBossIntro();
    this.world.resetCamera();
    this.world.setBackdrop("./assets/textures/office_bg.png");
    this.world.setMood(CONFIG.colors.fog); // Tint auf Default zurück
    this._applyVision(); // Sicht-Radius auf Basis (Fog of War)
    // Rubber-Duck-Guide nur beim allerersten Run zeigen.
    if (!this.meta.guideSeen) {
      this.guide.start(() => { this.meta.guideSeen = true; this._saveMeta(); });
    } else {
      this.guide.stop();
    }
    this.state = STATE.PLAYING;

    // Onboarding-Chat mit Claude (vor animierter Kampf-Cutscene): einmal pro
    // Sitzung — Restarts nach Tod überspringen ihn.
    if (!this._introSeen) {
      this._introSeen = true;
      this.cutsceneActive = true;
      this.introChat.play().then(() => { this.cutsceneActive = false; });
    }
  }

  // maxHp aus Mods übernehmen (z.B. nach Upgrade).
  _syncStats() {
    this.player.maxHp = this._maxHp();
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) this.hud.showPause();
    else this.hud.hidePause();
  }

  resume() {
    this.paused = false;
    this.hud.hidePause();
  }

  toggleInventory() {
    this.invOpen = !this.invOpen;
    if (this.invOpen) { this._renderInv(); this.hud.showInventory(); }
    else this.hud.hideInventory();
  }

  _renderInv() {
    this.hud.renderInventory(this.inventory, {
      onEquip: (i) => { if (this.inventory.equip(i)) { this._applyEquipment(); this._renderInv(); } },
      onUnequip: (i) => { if (this.inventory.unequip(i)) { this._applyEquipment(); this._renderInv(); } },
    });
  }

  sortInventory() {
    this.inventory.sort();
    this._renderInv();
  }

  toggleShop() {
    this.shopOpen = !this.shopOpen;
    if (this.shopOpen) {
      if (this.shopOffers.length === 0) this._rollShop();
      this.hud.hidePrompt();
      this._renderShop();
      this.hud.showShop();
    } else {
      this.hud.hideShop();
    }
  }

  _rollShop() {
    this.shopOffers = [];
    for (let i = 0; i < 5; i++) this.shopOffers.push(this._makeOffer());
  }

  // Ein zufälliges Angebot (Waffe / Ausrüstung / Gadget).
  _makeOffer() {
    const r = Math.random();
    if (r < 0.4) {
      const id = WEAPON_IDS[Math.floor(Math.random() * WEAPON_IDS.length)];
      const w = WEAPONS[id];
      // Echter Tier-Preis (±10 % Streuung), damit starke Waffen teuer bleiben.
      const base = WEAPON_PRICE[id] ?? 90;
      const price = Math.round(base * (0.92 + Math.random() * 0.16));
      const req = WEAPON_LEVEL[id] || 2;
      return { type: "weapon", id, icon: w.icon, name: w.name, desc: w.desc + ` · ab Lvl ${req}`, price, req };
    } else if (r < 0.72) {
      const it = rollItem();
      return { type: "item", item: it, icon: it.icon, name: it.name, desc: it.desc,
        price: 40 + Math.floor(Math.random() * 40) };
    }
    const id = GADGET_IDS[Math.floor(Math.random() * GADGET_IDS.length)];
    const g = GADGETS[id];
    const lvl = this.gadgets[id] || 0;
    return { type: "gadget", id, icon: g.icon, name: g.name + " ▸ Lv" + (lvl + 1),
      desc: g.desc, price: gadgetPrice(lvl) };
  }

  _renderShop() {
    this.hud.renderShop(this.shopOffers, this.coins, (i) => this._buy(i));
  }

  _buy(i) {
    const o = this.shopOffers[i];
    if (!o || this.coins < o.price) return;
    if (o.type === "weapon" && this.progression.level < (o.req || 2)) {
      this.hud.toast?.("🔒", "Level zu niedrig", `${WEAPONS[o.id].name} ab Lvl ${o.req}`);
      this.audio.error?.();
      return;
    }
    this.coins -= o.price;
    this.hud.setCoins(this.coins);
    this.audio.pickup();
    if (o.type === "weapon") {
      this._setWeapon(o.id);
      this.hud.banner("GEKAUFT", WEAPONS[o.id].name);
    } else if (o.type === "item") {
      this.inventory.add(o.item);
      this.hud.banner("GEKAUFT", o.item.icon + " " + o.item.name);
    } else if (o.type === "gadget") {
      this.buyGadget(o.id);
      this.hud.banner("GEKAUFT", GADGETS[o.id].icon + " " + GADGETS[o.id].name);
    }
    this.shopOffers[i] = this._makeOffer(); // sofort neuer Nachschub
    this._renderShop();
  }

  // Einmaliges Tutorial pro Station/Mechanik: zeigt einmalig (über alle Runs) die
  // Enten-Sprechblase, was man hier tun kann. Nicht während des Onboarding-Guides.
  _tut(key, text) {
    if (!this.meta.tutSeen) this.meta.tutSeen = {};
    if (this.meta.tutSeen[key]) return;
    if (this.guide?.active) return; // Onboarding nicht stören
    this.meta.tutSeen[key] = true;
    this._saveMeta();
    this.hud.tutorial(text);
  }

  // Run-Coins + Statistik EINMAL in die persistente Bank buchen.
  // Spieler nahe der Funktions-Station eines Raums (= Raummitte)?
  _stationNear(name, r = 5) {
    const room = this.world.building?.rooms?.[name];
    if (!room) return false;
    const cx = (room.minX + room.maxX) / 2, cz = (room.minZ + room.maxZ) / 2;
    return Math.hypot(this.player.pos.x - cx, this.player.pos.z - cz) <= r;
  }

  // VAULT: Run-Coins sicher in die Bank einzahlen (= Meta-Währung für dauerhafte
  // Upgrades) und Enten-Skins freischalten. Macht den Vault-Raum nützlich.
  _useVault() {
    const amt = this.coins;
    if (amt > 0) {
      this.meta.coins += amt;
      this.coins = 0;
      this.hud.setCoins(0);
      this._saveMeta();
      this._showMetaLine();
      this.audio.buy?.();
      this.world.addShake(0.12);
      this.hud.toast("🏦", "Eingezahlt", `+${amt} 🪙 sicher in der Bank`);
    }
    this.openSkins("bank"); // mit Bank-Coins Skins kaufen/anlegen
  }

  // POWER-UPS (West): zufälliges Power-Up für Coins kaufen (sofort aktiv).
  _usePowerupShop() {
    const price = 40;
    if (this.coins < price) { this.hud.toast("⚡", "Power-Up", `Kostet ${price} 🪙`); this.audio.error?.(); return; }
    this.coins -= price; this.hud.setCoins(this.coins);
    const id = POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)];
    this._activatePower(id);
  }

  // BUG-FARM (Nord): Coins zahlen → schwache Bugs spawnen, die man für XP killt.
  _useSpawner() {
    const price = 30;
    if (this.coins < price) { this.hud.toast("🐛", "Bug-Farm", `Kostet ${price} 🪙`); this.audio.error?.(); return; }
    this.coins -= price; this.hud.setCoins(this.coins);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 12;
      this.enemies.spawn("syntax", this.player.pos.x + Math.cos(a) * r, this.player.pos.z + Math.sin(a) * r);
    }
    this.hud.banner("🐛 BUG-FARM", "Bugs gespawnt – killen für XP!");
    this.audio.buy?.();
    this.world.addShake(0.15);
  }

  // RÄTSELRAUM: Debug-Challenge – fliehende Bug-Ziele spawnen, die man für
  // Bonus-Coins abschießt. Cooldown verhindert Dauer-Farmen. Macht den Raum nützlich.
  _startChallenge() {
    if (this._challengeActive) return;
    if ((this._challengeCD || 0) > 0) {
      this.hud.toast("⏳", "Challenge", `Bereit in ${Math.ceil(this._challengeCD)}s`);
      return;
    }
    const R = this.world.building?.rooms?.puzzle;
    if (!R) return;
    this._challengeActive = true;
    this._challengeTimer = 16;
    this._challengeCD = 50;
    const pad = 7;
    for (let i = 0; i < 6; i++) {
      const x = R.minX + pad + Math.random() * (R.maxX - R.minX - 2 * pad);
      const z = R.minZ + pad + Math.random() * (R.maxZ - R.minZ - 2 * pad);
      const e = this.enemies.spawn("bonus", x, z);
      if (e) e.ttl = 20; // länger als der Timer → bleiben bis abgeschossen/Ende
    }
    this.hud.banner("🐞 DEBUG-CHALLENGE", "Schieß alle Bugs! 16 Sek · je 60 🪙");
    this.hud.flash("#39ff9a", 0.3);
    this.audio.buy?.();
  }

  _bankRun() {
    if (this._banked) return;
    this._banked = true;
    const score = Math.floor(this.score);
    if (score > this.highscore) {
      this.highscore = score;
      localStorage.setItem(HISCORE_KEY, String(score));
    }
    this.meta.coins += this.coins;
    this.meta.bestWave = Math.max(this.meta.bestWave, this.waves.wave);
    this.meta.kills += this.runStats.kills;
    this._saveMeta();
    this._showMetaLine();
  }

  // Ergebnis als teilbaren Text in die Zwischenablage kopieren (Community-Hook).
  shareResult() {
    const score = Math.floor(this.score);
    const sector = Math.min(CONFIG.campaign.sectors, this.meta.sectorsCleared + (this.won ? 0 : 1));
    const kills = this.runStats?.kills || 0;
    const wave = this.waves?.wave || 1;
    const url = (typeof location !== "undefined" && location.origin + location.pathname) || "";
    const text =
      `🦆 SKAILE Building Challenge\n` +
      `${this.won ? "🏆 MAINBOARD BEFREIT! " : ""}Score ${score.toLocaleString("de-DE")} · Welle ${wave} · Sektor ${sector}/${CONFIG.campaign.sectors} · ${kills} Bugs gedebuggt\n` +
      `Schaffst du mehr? ${url}`.trim();
    const done = () => this.hud.toast?.("📋", "Kopiert!", "Ergebnis ist in der Zwischenablage – einfügen & teilen");
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => this._shareFallback(text));
      else this._shareFallback(text);
    } catch (e) { this._shareFallback(text); }
  }

  _shareFallback(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
      this.hud.toast?.("📋", "Kopiert!", "Ergebnis ist in der Zwischenablage");
    } catch (e) { this.hud.toast?.("📋", "Teilen", text); }
  }

  // Steht die Ente am Tor? (Reichweite zum Reparieren/Verstärken)
  _gateNear() {
    return this.gate &&
      Math.hypot(this.player.pos.x - this.gate.x, this.player.pos.z - this.gate.z) <= 6.5;
  }

  _removeGateWall() {
    const w = this._gateWall, arr = this.world.building?.walls;
    if (w && arr) { const i = arr.indexOf(w); if (i >= 0) arr.splice(i, 1); }
  }

  // Coins ausgeben: Tor reparieren+verstärken – oder ein gefallenes Tor wieder aufbauen.
  _reinforceGate() {
    const cost = this._gateCost || 40;
    if (this.coins < cost) { this.hud.toast?.("🛡️", "Tor", `Kostet ${cost} 🪙`); this.audio.error?.(); return; }
    this.coins -= cost; this.hud.setCoins(this.coins);
    const wasDead = !this.gate.alive;
    this.gate.maxHp += 70;
    this.gate.hp = this.gate.maxHp;
    this.audio.buy?.();
    this.world.addShake(0.12);
    this.hud.flash?.("#c79a5a", 0.2);
    if (wasDead) {
      this._gateBreached = false;
      if (this._gateWall && this.world.building?.walls && !this.world.building.walls.includes(this._gateWall)) {
        this.world.building.walls.push(this._gateWall);
      }
      this.hud.banner?.("🛡️ TOR WIEDER AUFGEBAUT", `Die Mauer steht wieder – max ${this.gate.maxHp} HP`);
    } else {
      this.hud.banner?.("🛡️ TOR VERSTÄRKT", `Voll repariert · +70 HP · max ${this.gate.maxHp}`);
    }
    this._gateCost = Math.round(cost * 1.5);
  }

  // Spieler fällt: statt sofort Game Over gibt's eine 5-Sek-Gnadenfrist (Respawn),
  // in der das Tor halten muss. Ist das Tor schon hin → echtes Game Over.
  _playerDown() {
    if (this.respawning) return;
    if (!this.gate || !this.gate.alive) { this.gameOver(); return; }
    this.respawning = true;
    this.respawnT = 5;
    this.player.alive = false;
    this.player._setVisible?.(false);
    this.world.addShake(0.7);
    this.effects.burst(this.player.pos.x, this.player.pos.z, CONFIG.colors.duckBody, 26, 1.5);
    this.hud.flash?.("#ff3b52", 0.4);
    this.hud.banner?.("💀 DOWN!", "Respawn in 5 s – das Tor muss halten!");
    this.audio.playerHurt?.();
    this._breakCombo();
  }

  _revive() {
    this.respawning = false;
    this.player.alive = true;
    this.player.hp = Math.max(1, Math.round(this.player.maxHp * 0.6));
    this.player.invuln = 2.5; // kurze Unverwundbarkeit nach dem Respawn
    this.player.pos.set(0, 0, -20); // nahe dem Tor wieder einsteigen
    this.player._setVisible?.(true);
    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.hud.banner?.("🦆 ZURÜCK!", "Verteidige das Tor weiter!");
    this.audio.levelUp?.();
    this.effects.flash?.(this.player.pos.x, 1.2, this.player.pos.z, 0x39ff9a, 3, 0.2);
  }

  // Das Tor ist gefallen → die Bugs fressen den PC + die Webseite. Run vorbei.
  _pcDestroyed() {
    this.world.addShake(1.0);
    this.hud.flash?.("#ff3b52", 0.6);
    this.effects.shockwave?.(this.pc.x, this.pc.z, 0xff3b52, 26, 30);
    this.effects.burst?.(this.pc.x, this.pc.z, 0xff5470, 36, 1.8);
    this.hud.banner?.("💀 PC ZERSTÖRT", "Die Bugs haben den Rechner zerfressen!");
    this.gameOver();
  }

  gameOver() {
    this.state = STATE.OVER;
    this.audio.gameOver();
    this.world.addShake(0.8);
    this.effects.burst(this.player.pos.x, this.player.pos.z, CONFIG.colors.duckBody, 30, 1.6);
    this._bankRun();
    this.audio.stopMusic();
    this.hud.showGameOver(Math.floor(this.score), this.waves.wave, this.highscore, this.runStats.kills);
  }

  // Großes Ziel erreicht: Final-Boss besiegt → Sieg. Run kann endlos weiterlaufen.
  _victory() {
    this.won = true;
    this.meta.won = true;
    this.meta.sectorsCleared = CONFIG.campaign.sectors;
    this._saveMeta();
    this.state = STATE.WON;
    this.audio.stopMusic();
    this.world.addShake(1.0);
    this.hud.flash("#ffd23f", 0.6);
    this.effects.shockwave(this.player.pos.x, this.player.pos.z, CONFIG.colors.duckBody, 26, 32);
    // Finale-Cutscene zuerst, danach erst der Sieg-Screen.
    const showWin = () => this.hud.showVictory(Math.floor(this.score), this.waves.wave, this.runStats.kills);
    this.playCutscene(STORY.ending).then(showWin);
  }

  // Nach dem Sieg im selben Run endlos weiterspielen.
  resumeFromVictory() {
    if (this.state !== STATE.WON) return;
    this.hud.hideVictory();
    this.audio.startMusic();
    this.state = STATE.PLAYING;
  }

  // Aktiven Run vorzeitig beenden (z.B. nach Sieg) → Coins buchen, ins Menü.
  endRunToMenu() {
    this._bankRun();
    this.audio.stopMusic();
    this.hud.hideVictory();
    this.hud.hideOverlays();
    this.state = STATE.MENU;
    this.hud.showStart();
  }

  // ----------------------------------------------------------------- Loop --
  // Cutscene abspielen; pausiert das Gameplay, bis sie fertig/übersprungen ist.
  playCutscene(scene) {
    if (!scene || !this.cutscene) return Promise.resolve();
    this.cutsceneActive = true;
    return this.cutscene.play(scene).then(() => { this.cutsceneActive = false; });
  }

  update(dt) {
    if (this.cutsceneActive) return; // Story läuft → Sim einfrieren
    if (this.state !== STATE.PLAYING) return;

    if (this.input.wasPressed("KeyP") || this.input.wasPressed("Escape")) {
      this.togglePause();
    }
    if (this.input.wasPressed("KeyI") || this.input.wasPressed("Tab")) {
      this.toggleInventory();
    }
    if (this.input.wasPressed("KeyE")) {
      const autoPad = this.automation.nearest(this.player.pos);
      const pad = this.armory.nearest(this.player.pos);
      const door = this.world.building?.lockedDoorNear?.(this.player.pos.x, this.player.pos.z);
      if (autoPad && !this.shopOpen) this._buyAutomation(autoPad);
      else if (pad && !this.shopOpen) this._buyWeapon(pad);
      else if (!this.shopOpen && this.armory.forgeNear(this.player.pos)) this.openForge();
      else if (door && !this.shopOpen) this._buyRoom(door);
      else if (!this.shopOpen && this._gateNear()) this._reinforceGate();
      else if (!this.shopOpen && this._stationNear("spawner")) this.openChips();
      else if (!this.shopOpen && this.stations.skinsNear(this.player.pos)) this.openSkins("riddle");
      else if (!this.shopOpen && this.stations.deployNear(this.player.pos)) this.startDefense();
      else if (this.shopOpen || this.stations.shopNear(this.player.pos)) this.toggleShop();
    }
    if (this.input.wasPressed("KeyG")) this.cycleGadget();
    if (this.input.wasPressed("KeyB")) this.audio.toggleMute(); // Mute (war M)

    // (Perspektiven-Wechsel entfernt – nur noch Vogelperspektive.)

    if (this.bossIntro) { this._updateIntro(dt); return; }
    // Run-Start-Draft: einmal pro Run den Build wählen (nach Onboarding).
    if (this._draftPending && !this.draftChoosing && !this.levelingUp &&
        !this.boonChoosing && !this.paused && !this.invOpen && !this.shopOpen && !this.guide?.active) {
      this._offerDraft();
    }
    // Sektor-Anomalie bei Sektor-Wechsel anwenden.
    const sec = Math.max(1, Math.ceil((this.waves?.wave || 1) / CONFIG.waves.bossEvery));
    if (!this.draftChoosing && !this._draftPending && sec !== this._activeSector) {
      this._activeSector = sec;
      this._applySectorMod(sec);
    }
    // Anstehenden Boon anbieten, sobald keine andere Auswahl offen ist.
    if (this.boonPending && !this.levelingUp && !this.boonChoosing && !this.draftChoosing &&
        !this.paused && !this.invOpen && !this.shopOpen) {
      this.boonPending = false;
      this._offerBoon();
    }
    if (this.paused || this.levelingUp || this.invOpen || this.shopOpen || this.boonChoosing || this.draftChoosing) return;

    // Hit-Stop: kurzes Einfrieren für spürbaren Impact.
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      dt *= 0.06;
    }

    // Respawn-Gnadenfrist: Spieler ist „down", das Tor muss währenddessen halten.
    if (this.respawning) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this._revive();
    }

    // Wellen starten automatisch, sobald das Intro durch ist (kein Deploy-Terminal mehr).
    if (!this._autoStarted && !this.defenseLoop && !this.cutsceneActive) {
      this._autoStarted = true;
      this.startDefense();
    }

    // Brand-Schaden (Feuerschwert) ticken.
    this._updateBurn(dt);

    this._autoCamera(dt);
    // Bewegung welt-relativ (W=hoch/Nord, S=runter, A=links, D=rechts) – sauber &
    // nicht invertiert. Die Drohnen-Kamera trailt hinterher (siehe updateCamera).
    const move = this.input.moveVector();
    this._updateFacing(dt, move);
    if (move.x !== 0 || move.z !== 0) this.guide.event("move");
    // Näherungs-Ereignisse für den Guide (Terminal / verschlossene Tür).
    if (this.stations.deployNear(this.player.pos)) this.guide.event("nearDeploy");
    if (this.world.building?.lockedDoorNear?.(this.player.pos.x, this.player.pos.z)) this.guide.event("nearDoor");

    // Energie regeneriert nach kurzer Verzögerung seit dem letzten Schuss.
    this.sinceShot += dt;
    if (this.sinceShot > CONFIG.energy.regenDelay && this.energy < CONFIG.energy.max) {
      this.energy = Math.min(CONFIG.energy.max, this.energy + CONFIG.energy.regen * dt);
      this.hud.setEnergy(this.energy / CONFIG.energy.max);
    }

    // CPU-Temperatur aktualisieren (Overclock halten, abkühlen, überhitzen).
    this._updateHeat(dt, move.x !== 0 || move.z !== 0);
    // Fabrikator-Druck läuft im Hintergrund weiter.
    this._updatePrint(dt);
    // Verbrauchsgüter zünden (Gürtel-Slots 1–4).
    for (let s = 1; s <= 4; s++) if (this.input.wasPressed("Digit" + s)) this.useConsumable(s);

    if (this.input.wasPressed("ShiftLeft") || this.input.wasPressed("ShiftRight")) {
      if (this.player.tryDash(this._dashCd())) {
        this.audio.dash();
        this.effects.burst(this.player.pos.x, this.player.pos.z, CONFIG.colors.cyan, 10, 0.9);
      }
    }

    this.player.update(dt, move, this._moveSpeed());

    if (this.mods.regen > 0 && this.player.alive) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.mods.regen * dt);
      this.hud.setHp(this.player.hp, this.player.maxHp);
    }

    if (this.input.wasPressed("KeyR") && this.ultReady && !this.ultActive) {
      this._activateUltimate();
    }
    this._updateBuffs(dt);

    const worldDt = this.ultActive ? dt * CONFIG.combo.ultSlowmo : dt;
    if (this.ultActive) {
      this.ultTimer -= dt;
      if (this.ultTimer <= 0) this._endUltimate();
    }
    // Zeitlupe-Powerup verlangsamt nur die Gegner.
    const enemyDt = worldDt * (this.buffs.slow > 0 ? 0.4 : 1);

    // Bonus-Bug (Mini-Jagd): nur während eines laufenden Deploys – im ruhigen
    // Bau-Modus soll nichts spawnen.
    this.bonusT -= dt;
    if (this.defenseLoop && this.bonusT <= 0 && !this.boss) {
      this.bonusT = 22 + Math.random() * 16;
      const { x, z } = edgeSpawn(this.world.arenaHalf);
      this.enemies.spawn("bonus", x, z);
      this.hud.banner("💰 BONUS BUG", "Schnapp ihn dir!");
    }

    // Granate erscheint gelegentlich während der Wellen (wie ein Energiefeld),
    // mit [F]-Hinweis: hingehen, F = aufheben, F = werfen (Flächenschaden).
    this._throwT -= dt;
    if (this.defenseLoop && this._throwT <= 0) {
      this._throwT = 16 + Math.random() * 14;
      const half = this.world.arenaHalf;
      const x = (Math.random() * 2 - 1) * (half - 5);
      const z = (Math.random() * 2 - 1) * (half - 5);
      this.throwables.spawnPickup(x, z);
      this.hud.toast("💣", "Granate aufgetaucht", "[F] aufheben & werfen!");
    }

    // Riesen-Magnet nach Level-Up läuft ab.
    if (this.magnetBoost > 0) this.magnetBoost = Math.max(0, this.magnetBoost - dt);
    if (this._pkStreakT > 0) this._pkStreakT -= dt; // Pickup-Serien-Fenster

    // Debug-Challenge (Rätselraum): Timer + Cooldown.
    if (this._challengeCD > 0) this._challengeCD = Math.max(0, this._challengeCD - dt);
    if (this._challengeActive) {
      this._challengeTimer -= dt;
      if (this._challengeTimer <= 0) {
        this._challengeActive = false;
        this.hud.banner("CHALLENGE VORBEI", "Gut gedebuggt! 🐞");
      }
    }

    // Bau-Ressourcen-HUD nur bei Änderung aktualisieren (nicht jeden Kill einzeln).
    if (this._matsDirty) {
      this._matsDirty = false;
      this.hud.setMats(this.mats.scrap, this.mats.chips, this.meta.data);
    }

    // Gelegentlicher Rubber-Duck-Tipp.
    this.tipT -= dt;
    if (this.tipT <= 0) {
      this.tipT = 24 + Math.random() * 16;
      this.hud.toast("🦆", "Rubber Duck", DUCK_TIPS[Math.floor(Math.random() * DUCK_TIPS.length)]);
    }

    // Wellen laufen nur während eines aktiven Deploys (opt-in). Im Bau-Modus
    // ist es ruhig – die Basis-Verwaltung ist der Kern, Kämpfe sind optional.
    if (this.defenseLoop) this.waves.update(dt, this.enemies.aliveCount());

    // Zeit-Tore: offen im Bau-Modus & in der Pause zwischen Wellen, ZU während
    // einer laufenden Welle. So kann man nur zwischen den Wellen shoppen.
    const gatesOpen = !this.defenseLoop || this.waves.state === "break";
    this.world.building?.setGatesOpen?.(gatesOpen, this.player.pos.x, this.player.pos.z);
    if (gatesOpen !== this._gatesWereOpen) {
      this._gatesWereOpen = gatesOpen;
      if (this.defenseLoop) {
        this.hud.banner(gatesOpen ? "🚪 TÜREN OFFEN" : "🔒 TÜREN ZU",
          gatesOpen ? "Schnell shoppen – bis die nächste Welle startet!" : "Welle läuft – Räume gesperrt");
      }
    }

    this.enemies.update(enemyDt, this.player.pos, this.ultActive, {
      shoot: (x, z, dx, dz, o) => this.enemyShots.spawn(x, z, dx, dz, o),
    }, this.gate, this.pc);
    // Tor aktualisieren; fällt es, bricht die Mauer auf → Bugs stürmen zum PC.
    if (this.gate) {
      this.gate.update(dt);
      if (!this.gate.alive && !this._gateBreached) {
        this._gateBreached = true;
        this._removeGateWall();
        this.hud.banner?.("🛑 TOR DURCHBROCHEN!", "Die Bugs greifen jetzt den PC an – schlag sie zurück!");
        this.hud.flash?.("#ff3b52", 0.5);
        this.world.addShake(0.7);
      }
    }
    // PC-Schaden-Feedback + Lose-Condition: Game Over ERST, wenn der PC zerstört ist.
    if (this.pc && this._gateBreached && this.state === STATE.PLAYING) {
      if (this.pc.hp < (this._pcHpPrev ?? this.pc.hp)) {
        this.effects.burst(this.pc.x, this.pc.z, 0xff5470, 4, 0.6);
      }
      this._pcHpPrev = this.pc.hp;
      this.hud.setObjective?.(`💻 PC-Integrität: ${Math.ceil((this.pc.hp / this.pc.maxHp) * 100)}% · schlag die Bugs zurück!`);
      if (!this.pc.alive) { this._pcDestroyed(); return; }
    }
    this.enemyShots.update(enemyDt);
    this._handleEnemyShots();
    this.projectiles.update(dt, {
      enemies: this.enemies.enemies,
      playerPos: this.player.pos,
      arenaHalf: this.world.arenaHalf,
      onArea: (x, z, r, dmg, color) => this._areaDamage(x, z, r, dmg, color),
    });
    this.effects.update(dt);
    this.pickups.update(dt, this.player.pos, this._magnet(), (kind, value) =>
      this._collect(kind, value)
    );

    // Temporäres Energiefeld: draufstehen lädt moderat nach.
    this.stations.update(dt, this.world.arenaHalf);
    if (this.stations.activeAt(this.player.pos) === "recharge") {
      this.energy = Math.min(CONFIG.energy.max, this.energy + 55 * dt);
      this.hud.setEnergy(this.energy / CONFIG.energy.max);
    }

    // Wurfobjekte: aufheben / werfen mit F.
    this.throwables.update(dt, (x, z) => this._throwImpact(x, z));

    // Idle-Helfer: Drohnen schießen selbstständig, Auto-Reparatur heilt.
    this.automation.update(dt, this.player.pos, (r) => this._nearestEnemy(r),
      (origin, dir) => this.projectiles.spawn(origin, dir, {
        damage: 1, pierce: 0, scale: 0.7, color: 0x6ee7ff, speed: 74, style: "ball",
      }));
    if (this.automation.levels.repair > 0 && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.automation.levels.repair * 2.2 * dt);
      this.hud.setHp(this.player.hp, this.player.maxHp);
    }

    // Automatischer TNT-Wurf auf die nächste Gegnergruppe.
    this.autoTntT -= dt;
    if (this.autoTntT <= 0) {
      const tgt = this._nearestEnemy(60);
      if (tgt) {
        this.autoTntT = 3.5;
        this.throwables.autoThrow(this.player.pos, tgt.mesh.position);
        this.audio.shoot?.();
      } else {
        this.autoTntT = 1.0; // gleich nochmal prüfen
      }
    }

    if (this.carrying) {
      this.carrying.mesh.position.set(this.player.pos.x, this.player.pos.y + 2.6, this.player.pos.z);
    }
    if (this.input.wasPressed("KeyF")) {
      if (this.carrying) {
        // Auto-Aim: wirft im Bogen direkt auf den nächsten Gegner (trifft immer).
        const t = this._nearestEnemy(70);
        if (t) this.throwables.throwItemAt(this.carrying, t.mesh.position.x, t.mesh.position.z);
        else this.throwables.throwItem(this.carrying, Math.sin(this.player.facing), Math.cos(this.player.facing));
        this.carrying = null;
        this.audio.shoot();
        this.world.addShake(0.1);
      } else {
        const it = this.throwables.nearestIdle(this.player.pos, 2.8);
        if (it) { it.state = "carried"; this.carrying = it; this.audio.pickup(); }
      }
    }

    this.armory.update(dt, this.player.pos);

    // Kontext-Hinweis: Automation/Armory/Shop haben Vorrang, sonst Wurfobjekt.
    const autoPad = this.automation.nearest(this.player.pos);
    const pad = this.armory.nearest(this.player.pos);
    if (autoPad && !this.shopOpen) {
      this.hud.showPrompt(this.automation.labelFor(autoPad.id));
    }
    else if (pad && !this.shopOpen) {
      const owned = this.weaponId === pad.id;
      const req = WEAPON_LEVEL[pad.id] || 2;
      const locked = this.progression.level < req;
      this.hud.showPrompt(owned ? `${WEAPONS[pad.id].name} (ausgerüstet)`
        : locked ? `🔒 ${WEAPONS[pad.id].name} – ab Lvl ${req}`
        : `[E] ${WEAPONS[pad.id].name} – ${pad.price} 🪙 (Lvl ${req})`);
    }
    else if (!this.shopOpen && this.armory.forgeNear(this.player.pos)) {
      this.hud.showPrompt(`[E] 🔨 SCHMIEDE – Waffen-Mods bauen (${this.mats.scrap} 🔩)`);
      this._tut("forge", "🔨 Das ist die Schmiede! Hier baust du aus 🔩 Schrott (droppt aus Bugs) permanente Waffen-Mods. Drück [E].");
    }
    else if (this.stations.shopNear(this.player.pos)) {
      this.hud.showPrompt("[E] 🛍️ SHOP");
      this._tut("shop", "🛍️ Der Shop! Hier kaufst du mit 🪙 Coins Power-Ups, Gadgets & Extras. Drück [E].");
    }
    else if (this.stations.skinsNear?.(this.player.pos)) {
      this.hud.showPrompt("[E] 👕 Skins (Claude-Rätsel)");
      this._tut("skins", "👕 Skin-Station! Skins schaltest du frei, indem du eine kleine Claude-Rätselfrage beantwortest. Drück [E].");
    }
    else if (this.world.building?.lockedDoorNear?.(this.player.pos.x, this.player.pos.z)) {
      const d = this.world.building.lockedDoorNear(this.player.pos.x, this.player.pos.z);
      this.hud.showPrompt(`[E] 🔒 ${d.label} freischalten – ${d.price} 🪙`);
    }
    else if (this._gateNear()) {
      this.hud.showPrompt(`[E] 🛡️ Tor reparieren & verstärken – ${this._gateCost || 40} 🪙`);
      this._tut("gate", "🛡️ Das ist dein Tor! Hier gibst du 🪙 Coins aus, um es voll zu reparieren UND dauerhaft stärker zu machen. Hält es nicht, fressen die Bugs den PC!");
    }
    else if (this._stationNear("spawner")) {
      this.hud.showPrompt(`[E] 🧩 CHIP-SOCKEL – Chips stecken (${this.mats.chips} 🧩)`);
      this._tut("chips", "🧩 Der Chip-Sockel! Steck 🧩 Chips ins Mainboard-Raster für Boni. Tipp: Gleiche Chips nebeneinander verstärken sich! Drück [E].");
    }
    else if (this.stations.deployNear(this.player.pos)) {
      this.hud.showPrompt(this.defenseLoop ? "[E] ⏸ Deploy-Schleife stoppen" : "[E] 🚀 DEPLOY starten (Dauerschleife)");
      this._tut("deploy", "🚀 Das Deploy-Terminal! [E] startet die Bug-Wellen. Halte dann [C] für OVERCLOCK (mehr Power, aber die CPU heizt auf – nicht überhitzen!).");
    }
    else if (this.carrying) this.hud.showPrompt("[F] werfen");
    else if (this.throwables.nearestIdle(this.player.pos, 2.8)) this.hud.showPrompt("[F] aufheben");
    else this.hud.hidePrompt();

    this._fireWeapon(dt);
    this._handleProjectileHits();
    this._handleEnemyContact();
    this._updateCombo(dt);

    // Gefahren-Vignette bei niedriger HP.
    const hpRatio = this.player.hp / this.player.maxHp;
    this.hud.setVignette(hpRatio < 0.35 ? (0.35 - hpRatio) / 0.35 : 0);

    if (this.boss && this.boss.alive) {
      const frac = this.boss.hp / this.boss.maxHp;
      this.hud.setBoss(frac, this.boss.def.label);
      this._checkBossPhase(frac);
    }

    // Minimap + verbleibende Gegner.
    this.hud.setRemaining(this.enemies.aliveCount());
    this.hud.renderMinimap({
      px: this.player.pos.x, pz: this.player.pos.z, half: this.world.arenaHalf,
      enemies: this.enemies.enemies
        .filter((e) => e.alive)
        .map((e) => ({ x: e.mesh.position.x, z: e.mesh.position.z, boss: e.def.isBoss, bonus: e.type === "bonus" })),
      shop: this.stations.shop,
    });

    // Kamera näher heranziehen, wenn die Ente in einem der kleinen Seitenräume ist.
    this.world.setCamZoom?.(this._inSideRoom());
    this.world.updateCamera(this.player.pos, dt);
  }

  // Ist die Ente in einem kleinen Seitenraum (nicht in der Arena)?
  _inSideRoom() {
    const R = this.world.building?.rooms; if (!R) return false;
    const x = this.player.pos.x, z = this.player.pos.z;
    for (const name of ["spawner", "armory"]) {
      const r = R[name];
      if (r && x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
    }
    return false;
  }

  // Kamera bleibt im CotL-Stil ruhig „gelockt" auf der Basis-Perspektive.
  // Nur Boss/Ultimate setzen bewusst eigene, dramatische Blickwinkel.
  _autoCamera(dt) {
    if (this.ultActive || this.boss) return;
    if (this.camRevert > 0) {
      this.camRevert -= dt;
      if (this.camRevert <= 0) this.world.resetCamera();
    }
  }

  // Auto-Ausrichten: Ente schwenkt sanft auf den nächsten Gegner.
  // CPU-Temperatur: Overclock ([C] halten) heizt rasant + boostet DPS; Feuern
  // heizt (in _fireWeapon); Bewegen/Pausen kühlt. Überhitzung drosselt die Waffe
  // und kostet HP, bis die Temp unter "recover" fällt (Hysterese).
  _updateHeat(dt, moving) {
    const H = CONFIG.heat;
    // Overclock nur halten, wenn nicht überhitzt und am Leben.
    const wantOC = this.input.isDown("KeyC") && !this.throttled && this.player.alive;
    if (wantOC && !this.overclock) this.audio.dash?.(); // kurzes Anwerf-Geräusch
    this.overclock = wantOC;

    // Heizen/Kühlen.
    if (this.overclock) {
      this.heat = Math.min(H.max, this.heat + H.overclockGain * (this._sectorHeatGain || 1) * dt);
    } else {
      let cool = (H.coolBase + (moving ? H.coolMove : 0) + (this.sinceShot > 0.5 ? H.coolIdle : 0) + (this._chipFlags?.heatCool || 0)) * (this._sectorHeatCool || 1);
      this.heat = Math.max(0, this.heat - cool * dt);
    }

    // Überhitzung einleiten.
    if (!this.throttled && this.heat >= H.max) {
      this.throttled = true;
      this.overclock = false;
      this.audio.playerHurt?.();
      this.hud.flash?.("#ff3b30", 0.5);
      this.hud.banner?.("🔥 ÜBERHITZT!", "Bewegen & abkühlen lassen");
      this.world.addShake(0.4);
    }
    // Während Throttle: HP-Schaden, bis genug abgekühlt (Hysterese).
    if (this.throttled) {
      if (this.player.alive) {
        this.player.hp = Math.max(0, this.player.hp - H.overheatDmg * dt);
        this.hud.setHp(this.player.hp, this.player.maxHp);
        if (this.player.hp <= 0) { this.player.alive = false; this._playerDown(); return; }
      }
      if (this.heat <= H.recover) {
        this.throttled = false;
        this.hud.banner?.("❄️ ABGEKÜHLT", "Waffe wieder bereit");
      }
    }

    // HUD-Temperaturbalken (Farbe via Ratio in hud.setHeat).
    this.hud.setHeat?.(this.heat / H.max, this.overclock, this.throttled);
  }

  // Blickrichtung: standardmäßig in Laufrichtung. Beim Schießen dreht sich die
  // Ente kurz zum nächsten Gegner (damit Schüsse treffen), danach zurück zur
  // Laufrichtung – kein „läuft geradeaus, guckt aber zur Seite".
  _updateFacing(dt, move) {
    // Nur Gegner in der vorderen Hälfte (Blickrichtung) werden anvisiert → man
    // muss sich zu den Feinden drehen, statt automatisch in alle Richtungen zu schießen.
    const target = this._frontTarget(CONFIG.energy.aimRange);
    this.aimTarget = target;
    const moving = move.x !== 0 || move.z !== 0;
    const firing = this.input.mouseDown || this.input.isDown("Space") ||
      this.input.isDown("Enter") || this.input.isDown("NumpadEnter");

    // Während (und kurz nach) dem Feuern auf den Gegner ausrichten.
    if (firing && target) this._aimHold = 0.35;
    else if (this._aimHold > 0) this._aimHold = Math.max(0, this._aimHold - dt);

    let want = this.player.facing;
    if (this._aimHold > 0 && target) {
      want = Math.atan2(target.mesh.position.x - this.player.pos.x,
        target.mesh.position.z - this.player.pos.z);
    } else if (moving) {
      want = Math.atan2(move.x, move.z); // in Laufrichtung schauen
    }
    const turn = this._aimHold > 0 ? CONFIG.energy.aimTurn : 12;
    this.player.facing = angleLerp(this.player.facing, want, turn, dt);
  }

  _nearestEnemy(range) {
    let best = null;
    let bestD = range;
    for (const e of this.enemies.enemies) {
      if (!e.alive || !e.visible) continue;
      const d = distXZ(this.player.pos, e.mesh.position);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // Nächster Gegner in der vorderen Hälfte (Blickrichtung). Gefährliche Typen
  // (Schützen/Springer/Boss) werden bei gleichem Abstand bevorzugt.
  _frontTarget(range) {
    const fx = Math.sin(this.player.facing), fz = Math.cos(this.player.facing);
    let best = null, bestScore = range;
    for (const e of this.enemies.enemies) {
      if (!e.alive || !e.visible) continue;
      const dx = e.mesh.position.x - this.player.pos.x, dz = e.mesh.position.z - this.player.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > range) continue;
      const dot = (dx * fx + dz * fz) / d; // cos(Winkel zwischen Blick & Gegner)
      if (dot < -0.2) continue; // hinter dir → ignorieren (vordere ~200°)
      const threat = (e.def.ranged || e.def.lunger || e.def.isBoss) ? 0.8 : 1; // Bedrohungen bevorzugen
      const score = d * threat;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  // -------------------------------------------------------------- Combat --
  _fireWeapon(dt) {
    if (!this.player.alive) return; // während der Respawn-Gnadenfrist nicht feuern
    this.fireTimer -= dt;
    const firing =
      this.input.mouseDown ||
      this.input.isDown("Space") ||
      this.input.isDown("Enter") ||
      this.input.isDown("NumpadEnter");
    if (!firing || this.fireTimer > 0) return;

    // Energie-Gating: leer ⇒ kein Dauerfeuer, muss nachladen.
    const cost = this.weapon.energyCost * this.mods.energyMult;
    if (this.energy < cost) return;
    this.energy -= cost;
    this.sinceShot = 0;
    this.hud.setEnergy(this.energy / CONFIG.energy.max);

    this.fireTimer = this._fireInterval() * (this.ultActive ? 0.5 : 1);

    // Nahkampf (Fäuste/Schwerter): Halbkreis-Schlag statt Projektile, keine Hitze.
    if (this.weapon.melee) { this._meleeSwing(); return; }

    // CPU-Hitze pro Schuss (im Overclock stärker; Sektor-Anomalie skaliert mit).
    this.heat = Math.min(CONFIG.heat.max, this.heat + CONFIG.heat.perShot * (this.overclock ? CONFIG.heat.overclockShotMult : 1) * (this._sectorHeatGain || 1));

    const n = this._projCount();
    const spread = this.weapon.spread * this.mods.spreadMult;
    const fwd = CONFIG.weapon.muzzleForward;
    const w = this.weapon;
    const speed = w.speed * this.mods.projSpeedMult;
    // Reichweite als echter Aspekt: range (Distanz) → Lebensdauer = range/speed.
    // So bleibt die Reichweite stabil, egal wie schnell das Geschoss fliegt.
    // Spezialbahnen (Bumerang, Granate, Orbit …) nutzen projLife als Laufzeit.
    // rangeMult kommt aus Upgrades/Items/Lab-Ausbau (Zielfernrohr).
    const rangeMult = this.mods.rangeMult || 1;
    let life;
    if (w.projLife != null) life = w.projLife * rangeMult;
    else if (w.range != null) life = (w.range * rangeMult) / Math.max(1, speed);
    const opts = {
      damage: this._damage(),
      pierce: this._pierce(),
      scale: this._projScale(),
      color: w.color,
      speed,
      style: w.style,
      // Kreative Verhalten (nur gesetzt, wenn die Waffe sie definiert).
      behavior: w.behavior, life,
      homingRate: w.homingRate, outTime: w.outTime,
      waveAmp: w.waveAmp, waveFreq: w.waveFreq,
      bounces: w.bounces, orbitR: w.orbitR, orbitSpin: w.orbitSpin,
      lob: w.lob, lobVy: w.lobVy,
      pullR: w.pullR, pullForce: w.pullForce,
      explodeR: w.explodeR, explodeDmg: w.explodeDmg,
      splitN: w.splitN, chainN: w.chainN, chainRange: w.chainRange,
    };
    // Auf den Zielgegner feuern (präzise), unabhängig davon, wie weit der Body
    // gerade gedreht ist; ohne Ziel in Blickrichtung.
    const baseAng = this.aimTarget
      ? Math.atan2(this.aimTarget.mesh.position.x - this.player.pos.x,
          this.aimTarget.mesh.position.z - this.player.pos.z)
      : this.player.facing;
    // Projektile starten an der Waffenspitze (nicht am Körper).
    const mz = this.player.muzzleWorld();
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      const ang = baseAng + off;
      const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
      const origin = { x: mz.x, z: mz.z };
      // Orbit-Waffen: Geschosse gleichmäßig auf den Kreis verteilen.
      if (w.behavior === "orbit") opts.orbitAng = (i / n) * Math.PI * 2 + baseAng;
      this.projectiles.spawn(origin, dir, opts);
    }
    this.audio.weapon(this.weapon.sound);
    this.player.kickWeapon(); // Rückstoß der getragenen Waffe (Wucht/„Feel")
    // Mündungsblitz an der Waffenspitze.
    this.effects.burst(mz.x, mz.z, this.weapon.color, 6, 0.55);
    this.effects.flash(mz.x, 1.2, mz.z, this.weapon.color, 2.4, 0.06); // heller Mündungsblitz
    this.player.recoil?.(); // Waffe zurückstoßen + Aim-Pose
    this.world.addShake(0.05);
  }

  // Halbkreis-Nahkampfschlag: trifft alle Gegner im Bogen vor der Ente.
  _meleeSwing() {
    const w = this.weapon;
    const range = (w.meleeRange || 2.5) * (this.mods.rangeMult || 1);
    const half = (w.arc || Math.PI) / 2;
    const dmg = this._damage() * (w.dmgMult || 1);
    const px = this.player.pos.x, pz = this.player.pos.z;
    const ang = this.aimTarget
      ? Math.atan2(this.aimTarget.mesh.position.x - px, this.aimTarget.mesh.position.z - pz)
      : this.player.facing;
    // Swing-Optik: heller Bogen aus Blitzen vor der Ente.
    for (let k = -1; k <= 1; k++) {
      const a = ang + k * half * 0.7;
      this.effects.flash?.(px + Math.sin(a) * range * 0.7, 1.1, pz + Math.cos(a) * range * 0.7, w.color || 0xffffff, 1.5, 0.08);
    }
    this.audio.weapon?.(w.sound || "shoot");
    this.player.recoil?.();
    this.player.meleeSwing?.(); // sichtbarer Schwung/Stoß
    this.world.addShake(0.05);
    let hits = 0;
    for (const e of this.enemies.enemies) {
      if (!e.alive || !e.visible) continue;
      const ex = e.mesh.position.x - px, ez = e.mesh.position.z - pz;
      const d = Math.hypot(ex, ez);
      if (d > range + e.radius) continue;
      let da = Math.atan2(ex, ez) - ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > half) continue; // außerhalb des Halbkreises
      const crit = Math.random() < CONFIG.juice.critChance + this.mods.critAdd;
      const hitDmg = crit ? dmg * CONFIG.juice.critMult : dmg;
      const killed = this.enemies.damage(e, hitDmg);
      this.effects.burst(e.mesh.position.x, e.mesh.position.z, w.color || 0xffffff, crit ? 9 : 5, crit ? 1.0 : 0.7);
      this.effects.flash?.(e.mesh.position.x, e.def.radius + 0.3, e.mesh.position.z, 0xffffff, crit ? 2.0 : 1.2, 0.08);
      this._popup(e.mesh.position, Math.round(hitDmg).toString(), crit ? "#ff4d6a" : "#fff2c0", crit ? "big" : "dmg");
      if (!e.def.isBoss) { const dl = d || 1; e.knockX = (ex / dl) * 9; e.knockZ = (ez / dl) * 9; }
      if (w.element === "fire") { e.burnT = 2.2; e.burnDps = Math.max(2, dmg * 0.5); }
      if (w.element === "ice") { e.slowT = 2.5; }
      if (killed) this._killEnemy(e);
      hits++;
    }
    if (hits) this._freeze(CONFIG.juice.hitStopKill);
  }

  // Brand-Schaden (Feuerschwert): tickt über Zeit auf brennende Gegner.
  _updateBurn(dt) {
    for (const e of this.enemies.enemies) {
      if (!e.alive || !e.burnT || e.burnT <= 0) continue;
      e.burnT -= dt;
      e._burnTick = (e._burnTick || 0) - dt;
      if (e._burnTick <= 0) {
        e._burnTick = 0.25;
        const killed = this.enemies.damage(e, (e.burnDps || 2) * 0.25);
        this.effects.burst(e.mesh.position.x, e.mesh.position.z, 0xff7a1a, 3, 0.5);
        if (killed) this._killEnemy(e);
      }
    }
  }

  _handleProjectileHits() {
    const list = this.projectiles.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      const pr = p.hitR ?? CONFIG.weapon.projRadius * p.mesh.scale.x;
      let retired = false;
      for (const e of this.enemies.enemies) {
        if (!e.alive || !e.visible || p.hits.has(e)) continue;
        if (distXZ(p.mesh.position, e.mesh.position) <= pr + e.radius) {
          p.hits.add(e);
          const crit = Math.random() < CONFIG.juice.critChance + this.mods.critAdd;
          const dmg = crit ? p.damage * CONFIG.juice.critMult : p.damage;
          const killed = this.enemies.damage(e, dmg);
          this.audio.hit();
          this.effects.burst(
            e.mesh.position.x, e.mesh.position.z, e.def.glow,
            crit ? 11 : 5, crit ? 1.0 : 0.7
          );
          // Heller Treffer-Funke + Rückstoß entlang der Flugrichtung (Wucht).
          this.effects.flash(e.mesh.position.x, e.def.radius + 0.3, e.mesh.position.z,
            crit ? 0xffd0d6 : 0xffffff, crit ? 2.2 : 1.3, 0.08);
          if (p.vel && !e.def.isBoss) {
            const vl = Math.hypot(p.vel.x, p.vel.z) || 1;
            const kb = crit ? 13 : 7;
            e.knockX = (p.vel.x / vl) * kb;
            e.knockZ = (p.vel.z / vl) * kb;
          }
          // Schadenszahl: Crit = große rote Zahl + Shake, normal = kleine helle Zahl.
          this._popup(e.mesh.position, Math.round(dmg).toString(),
            crit ? "#ff4d6a" : "#fff2c0", crit ? "big" : "dmg");
          if (crit) this.world.addShake(0.05);
          if (killed) this._killEnemy(e);

          // --- Trefferbasierte Spezial-Effekte der kreativen Waffen ---------
          // Explosion am Einschlag (Raketen/Granaten bei Direkttreffer).
          // Singularität explodiert NICHT bei Kontakt, nur am Lebensende.
          if (p.explodeR && p.behavior !== "blackhole") {
            this._areaDamage(p.mesh.position.x, p.mesh.position.z, p.explodeR, p.explodeDmg || p.damage, p.color, e);
            this.projectiles.retire(i); retired = true; break;
          }
          // Kettenblitz: springt zu nahen Gegnern weiter.
          if (p.chainN > 0) {
            this._chainLightning(e, p.chainN, p.chainRange || 8, p.damage, p.color, p.hits);
          }
          // Zellteilung: beim ersten Treffer in Splitter zerfallen.
          if (p.splitN > 0 && !p.fromSplit) {
            this._splitProjectile(p, e);
            this.projectiles.retire(i); retired = true; break;
          }

          if (p.pierce > 0) {
            p.pierce--;
          } else {
            this.projectiles.retire(i);
            retired = true;
            break;
          }
        }
      }
      if (retired) continue;
    }
  }

  // Flächenschaden um (x,z): trifft alle Gegner im Radius (außer Quelle, die
  // schon getroffen wurde). Für Explosionen (Granate/Rakete/Singularität).
  _areaDamage(x, z, radius, dmg, color = 0xff8c1a, source = null) {
    this.audio.hit();
    this.effects.shockwave(x, z, color, radius, 26);
    this.effects.burst(x, z, color, 16, 1.2);
    this.world.addShake(0.18);
    for (const e of this.enemies.enemies) {
      if (!e.alive || !e.visible || e === source) continue;
      if (distXZ({ x, z }, e.mesh.position) <= radius + e.radius) {
        if (!e.def.isBoss) { // radial wegschleudern
          const ax = e.mesh.position.x - x, az = e.mesh.position.z - z;
          const al = Math.hypot(ax, az) || 1;
          e.knockX = (ax / al) * 12; e.knockZ = (az / al) * 12;
        }
        if (this.enemies.damage(e, dmg)) this._killEnemy(e);
      }
    }
  }

  // Kettenblitz: vom getroffenen Gegner zu bis zu n nahen weiteren springen.
  _chainLightning(from, n, range, dmg, color, hitSet) {
    let cur = from;
    for (let j = 0; j < n; j++) {
      let best = null, bd = range;
      for (const e of this.enemies.enemies) {
        if (!e.alive || !e.visible || hitSet.has(e) || e === cur) continue;
        const d = distXZ(cur.mesh.position, e.mesh.position);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hitSet.add(best);
      this.effects.burst(best.mesh.position.x, best.mesh.position.z, color, 6, 0.8);
      if (this.enemies.damage(best, dmg)) this._killEnemy(best);
      cur = best;
    }
  }

  // Zellteilung: Geschoss zerfällt in mehrere kleine Splitter im Fächer.
  _splitProjectile(p, e) {
    const base = Math.atan2(p.vel.x, p.vel.z);
    const dmg = Math.max(1, Math.round(p.damage * 0.6));
    for (let k = 0; k < p.splitN; k++) {
      const a = base + (k - (p.splitN - 1) / 2) * 0.5;
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      this.projectiles.spawn(
        { x: e.mesh.position.x, z: e.mesh.position.z }, dir,
        { damage: dmg, pierce: 1, scale: 0.6, color: p.color, speed: 60, style: "ball",
          life: 0.6, fromSplit: true }
      );
    }
  }

  _handleEnemyContact() {
    // Gift-Pfützen (Memory-Leak-Spur): Schaden beim Drinstehen (Invuln begrenzt's).
    if (this.enemies.hazardAt(this.player.pos.x, this.player.pos.z)) {
      if (this.player.takeDamage(6)) {
        this.audio.playerHurt?.();
        this.hud.setHp(this.player.hp, this.player.maxHp);
        this.hud.flash("#80ed99", 0.25);
        if (!this.player.alive) { this._playerDown(); return; }
      }
    }
    for (const e of this.enemies.enemies) {
      if (!e.alive || e.def.damage <= 0) continue; // Bonus-Bug tut nichts
      const hitR = CONFIG.player.radius + e.radius;
      if (distXZ(this.player.pos, e.mesh.position) <= hitR) {
        const hurt = this.player.takeDamage(e.def.damage);
        if (hurt) {
          this.audio.playerHurt();
          if (e.def.damage >= CONFIG.player.bigHitDamage) this.audio.ouch();
          this.world.addShake(0.75);
          this._freeze(CONFIG.juice.hitStopHurt);
          this.hud.flash("#ff5470", 0.35);
          this.effects.shockwave(this.player.pos.x, this.player.pos.z, CONFIG.colors.red, 4, 12);
          this.hud.setHp(this.player.hp, this.player.maxHp);
          this._breakCombo();
          if (!this.player.alive) { this._playerDown(); return; }
        }
        const dx = e.mesh.position.x - this.player.pos.x;
        const dz = e.mesh.position.z - this.player.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        e.mesh.position.x += (dx / len) * CONFIG.player.contactKnockback * 0.2;
        e.mesh.position.z += (dz / len) * CONFIG.player.contactKnockback * 0.2;
      }
    }
  }

  _throwImpact(x, z) {
    // Fette TNT-Explosion: Feuerball aus warmen Tönen, doppelte Schockwelle,
    // greller Screen-Flash, Screenshake und kurzer Hit-Stop für Wucht.
    this.world.addShake(0.85);
    this._freeze(CONFIG.juice.hitStopBoss);
    this.effects.shockwave(x, z, 0xfff3b0, 9, 22); // heller Kern-Ring
    this.effects.shockwave(x, z, 0xff8c1a, 6.5, 14); // orange Druckwelle
    this.effects.burst(x, z, 0xff8c1a, 26, 1.6); // Feuer
    this.effects.burst(x, z, 0xffd23f, 18, 1.2); // Funken
    this.effects.burst(x, z, 0x6b6b6b, 12, 0.7); // Rauch/Schutt
    this.hud.flash("#ffb454", 0.35);
    this.audio.bugDeath();
    for (const e of [...this.enemies.enemies]) {
      if (e.alive && distXZ({ x, z }, e.mesh.position) <= 4.5) {
        if (this.enemies.damage(e, 6)) this._killEnemy(e);
      }
    }
  }

  _handleEnemyShots() {
    const list = this.enemyShots.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (distXZ(this.player.pos, s.spr.position) <= CONFIG.player.radius + s.radius) {
        if (this.player.takeDamage(s.damage)) {
          this.audio.playerHurt();
          if (s.damage >= CONFIG.player.bigHitDamage) this.audio.ouch();
          this.world.addShake(0.6);
          this.hud.flash("#ff5470", 0.3);
          this.hud.setHp(this.player.hp, this.player.maxHp);
          this._breakCombo();
          if (!this.player.alive) { this._playerDown(); return; }
        }
        this.enemyShots.retire(i);
      }
    }
  }

  _killEnemy(e) {
    this.enemies.kill(e);
    this.audio.killSound(this.combo);
    // Kill-Hitstop: spürbarer Impact bei Boss/großen Bugs & alle 10 Combo-Kills
    // (nicht bei jedem Schwarm-Bug → kein Dauer-Ruckeln).
    if (e.def.isBoss) this._freeze(CONFIG.juice.hitStopBoss);
    else if (e.def.radius >= 1.0 || (this.combo > 0 && this.combo % 10 === 0)) this._freeze(CONFIG.juice.hitStopKill);
    // Fetterer Kill-Effekt: Partikel-Pop + kurze Schockwelle (Bugs „zerplatzen").
    this.effects.burst(e.mesh.position.x, e.mesh.position.z, e.def.color, e.def.isBoss ? 44 : 20, e.def.isBoss ? 1.8 : 1.25);
    if (!e.def.isBoss && e.def.radius >= 1.0) this.effects.shockwave(e.mesh.position.x, e.mesh.position.z, e.def.glow, e.def.radius * 2.5, e.def.radius * 7);
    this.world.addShake(e.def.isBoss ? 1.0 : 0.07); // Kill-Shake stark reduziert (kein Dauer-Wackeln im Schwarm)

    // Heller Kill-Blitz + Squish bei größeren Bugs; Bosse bekommen ein Finale.
    this.effects.flash(e.mesh.position.x, e.def.radius + 0.4, e.mesh.position.z,
      e.def.glow || 0xffffff, e.def.isBoss ? 5 : 1.8, 0.1);
    if (e.def.radius >= 1.0) this.audio.bugDeath();
    if (e.def.isBoss) { // Boss-Tod: Slow-Mo + Screen-Flash + Extra-Schockwelle
      this._freeze(0.26);
      this.hud.flash?.("#fff2c0", 0.25);
      this.effects.shockwave(e.mesh.position.x, e.mesh.position.z, e.def.glow || 0xffd23f, 30, 34);
    }

    this.combo++;
    this.comboTimer = CONFIG.combo.decayTime;
    this.comboMult = 1 + Math.floor(this.combo / 5);
    const gained = e.def.score * this.comboMult;
    this.score += gained;
    this.hud.setScore(Math.floor(this.score));
    this.hud.setCombo(this.comboMult);
    if (this.combo % 10 === 0) this.hud.flash?.("#ffd23f", 0.1); // Combo-Meilenstein-Blitz
    // Score poppt groß, wenn ein Combo-Multiplikator aktiv ist (befriedigender).
    this._popup(e.mesh.position, "+" + gained, "#ffd23f", this.comboMult > 1 ? "big" : "");

    // Boon: Vampir-Modus heilt pro Kill.
    if (this.boonFlags.lifesteal > 0 && this.player.alive && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.boonFlags.lifesteal);
      this.hud.setHp(this.player.hp, this.player.maxHp);
    }

    // Run-Statistik + Achievements.
    this.runStats.kills++;
    if (e.def.isBoss) this.runStats.bossKills++;
    if (e.type === "bonus") this.runStats.bonus++;
    if (this.combo > this.runStats.maxCombo) this.runStats.maxCombo = this.combo;
    this._checkAch();

    if (!this.ultActive) {
      this.ultCharge += CONFIG.combo.ultPerKill;
      const ratio = this.ultCharge / CONFIG.combo.ultThreshold;
      if (ratio >= 1 && !this.ultReady) {
        this.ultReady = true;
        this.hud.banner("RUBBER DUCK MOMENT", "[ Q ] bereit");
      }
      this.hud.setUltimate(ratio, this.ultReady);
    }

    this.pickups.spawnGem(e.mesh.position.x, e.mesh.position.z, CONFIG.pickups.gemValue);
    if (Math.random() < CONFIG.pickups.healthDropChance) {
      this.pickups.spawnHealth(e.mesh.position.x, e.mesh.position.z);
    }
    if (Math.random() < 0.05) {
      this.pickups.spawnLoot(e.mesh.position.x, e.mesh.position.z, rollItem());
    }
    if (Math.random() < 0.02) {
      this.pickups.spawnLucky(e.mesh.position.x, e.mesh.position.z);
    }
    if (Math.random() < 0.03) {
      this.pickups.spawnPower(
        e.mesh.position.x, e.mesh.position.z,
        POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)]
      );
    }

    // Coins (Boon "Gierschlund" erhöht den Ertrag). Bewusst knapper als früher
    // (score/15 statt score/10), damit man auf die besseren Waffen hinsparen muss.
    this.coins += Math.max(1, Math.round((e.def.score / 15) * this.boonFlags.coinMult * (this._sectorCoinMult || 1)));
    this.hud.setCoins(this.coins);

    // Bau-Ressourcen: jeder Kill gibt etwas Schrott; Chips selten (Elite/Boss öfter);
    // Daten sammeln sich permanent fürs Forschungslabor. Direkt gutgeschrieben
    // (kein Boden-Loot → kein Gewusel), mit gelegentlichem Popup als Feedback.
    const big = e.def.isBoss || e.def.radius >= 1.1;
    const dm = this._dropMult || { scrap: 1, data: 1 };
    const scrap = Math.round((e.def.isBoss ? 25 : big ? 3 : 1) * dm.scrap);
    this.mats.scrap += scrap;
    let gotChip = 0;
    const chipChance = e.def.isBoss ? 1 : big ? 0.12 : 0.02;
    if (Math.random() < chipChance) { gotChip = e.def.isBoss ? 3 : 1; this.mats.chips += gotChip; }
    this.meta.data += Math.round((e.def.isBoss ? 10 : big ? 2 : 1) * dm.data);
    this._matsDirty = true; // HUD/Meta-Speicher am Frame-Ende aktualisieren
    if (gotChip) this._popup(e.mesh.position, "+" + gotChip + " 🧩", "#c792ea", "dmg");
    else if (big) this._popup(e.mesh.position, "+" + scrap + " 🔩", "#9fb4d4", "dmg");

    // Bonus-Bug erwischt → fette Belohnung.
    if (e.type === "bonus") {
      this.coins += 60;
      this.hud.setCoins(this.coins);
      this.pickups.spawnLucky(e.mesh.position.x, e.mesh.position.z);
      this.hud.flash("#ffd23f", 0.4);
      this.hud.banner("💰 BONUS!", "+60 Coins");
    }

    if (e.def.isBoss) {
      this.boss = null;
      this.hud.hideBoss();
      // Sektor gesäubert → Fortschritt persistieren + passenden Banner zeigen.
      const sector = Math.floor(this.waves.wave / CONFIG.waves.bossEvery);
      const sName = CONFIG.campaign.sectorNames[sector - 1] || ("Sektor " + sector);
      if (sector > this.meta.sectorsCleared) {
        this.meta.sectorsCleared = Math.min(CONFIG.campaign.sectors, sector);
        this._saveMeta();
        this._showProgress();
      }
      const isFinal = this.waves.wave >= CONFIG.campaign.finalWave;
      this.hud.banner(
        isFinal ? "🏆 MAINBOARD BEFREIT" : `SEKTOR ${Math.min(sector, CONFIG.campaign.sectors)}/${CONFIG.campaign.sectors} GESÄUBERT`,
        sName
      );
      this.hud.flash("#ffd23f", 0.45);
      this._freeze(CONFIG.juice.hitStopBoss);
      this.world.resetCamera();
      this.effects.shockwave(e.mesh.position.x, e.mesh.position.z, e.def.glow, 18, 24);
      this.pickups.spawnHealth(e.mesh.position.x, e.mesh.position.z);
      for (let i = 0; i < 8; i++) {
        this.pickups.spawnGem(
          e.mesh.position.x + (Math.random() - 0.5) * 4,
          e.mesh.position.z + (Math.random() - 0.5) * 4, 2
        );
      }
      this.pickups.spawnLoot(e.mesh.position.x + 2, e.mesh.position.z, rollItem());
      this.pickups.spawnLoot(e.mesh.position.x - 2, e.mesh.position.z, rollItem());
      this.pickups.spawnLucky(e.mesh.position.x, e.mesh.position.z + 2);

      // Meilenstein bei Welle 25 (Gebäude befreit), aber ENDLOS weiterspielen –
      // Survival-Fokus: überlebe so viele Wellen wie möglich.
      if (this.waves.wave >= CONFIG.campaign.finalWave && !this.won) {
        this.won = true;
        this.meta.won = true;
        this.meta.sectorsCleared = CONFIG.campaign.sectors;
        this._saveMeta();
        this.world.addShake(1.0);
        this.hud.flash("#ffd23f", 0.6);
        this.effects.shockwave(this.player.pos.x, this.player.pos.z, CONFIG.colors.duckBody, 26, 32);
        this.hud.banner("🏆 MAINBOARD BEFREIT!", "Endlos-Modus – überlebe so lange du kannst!");
      } else {
        // Sektor-Zwischenszene (einmal pro Sitzung), kurz nach dem Spektakel,
        // damit Boss-Tod, Loot & Banner noch sichtbar abklingen.
        const scene = STORY.sectors[sector];
        if (scene && !this._seenSectorCS.has(sector)) {
          this._seenSectorCS.add(sector);
          setTimeout(() => { if (this.state === STATE.PLAYING) this.playCutscene(scene); }, 1400);
        }
      }
    }

    if (e.def.splits) {
      for (let i = 0; i < e.def.splits; i++) {
        const off = (i - 0.5) * 1.6;
        const child = this.enemies.spawn("syntax", e.mesh.position.x + off, e.mesh.position.z + off);
        child.baseScale *= 0.7;
        child.radius *= 0.7;
      }
    }
    this.enemies.cull();
  }

  // Einsammel-Juice: bei schnellen Serien steigt die Tonhöhe + kleiner heller Pop.
  _pickupJuice(pos) {
    this._pkStreak = (this._pkStreakT > 0 ? (this._pkStreak || 0) + 1 : 1);
    this._pkStreakT = 0.6;
    this.audio.pickup(this._pkStreak);
    this.effects.flash(pos.x, 0.9, pos.z, 0x9fffe0, 1.0, 0.07);
  }

  _collect(kind, value) {
    if (kind === "gem") {
      this._pickupJuice(this.player.pos);
      this.effects.burst(this.player.pos.x, this.player.pos.z, CONFIG.colors.cyan, 4, 0.4);
      const leveled = this.progression.addXp(value);
      this.hud.setXp(this.progression.ratio(), this.progression.level);
      if (leveled > 0) this._queueLevelUp(leveled);
    } else if (kind === "health") {
      this.player.hp = clamp(this.player.hp + value, 0, this.player.maxHp);
      this.hud.setHp(this.player.hp, this.player.maxHp);
      this._popup(this.player.pos, "+" + value + " HP", "#80ed99");
    } else if (kind === "loot") {
      this.inventory.add(value);
      this.audio.levelUp();
      this.hud.banner("LOOT", value.icon + " " + value.name);
      if (this.invOpen) this._renderInv();
    } else if (kind === "coin") {
      this.coins += value;
      this.hud.setCoins(this.coins);
      this._pickupJuice(this.player.pos);
    } else if (kind === "lucky") {
      this._luckyReward();
    } else if (kind === "power") {
      this._activatePower(value);
    }
  }

  _activatePower(type) {
    const meta = POWERUPS[type];
    if (!meta) return;
    this.audio.levelUp();
    this.hud.flash("#" + meta.color.toString(16).padStart(6, "0"), 0.4);
    this.world.addShake(0.3);
    if (type === "nuke") {
      for (const e of [...this.enemies.enemies]) {
        if (e.alive && !e.def.isBoss && distXZ(this.player.pos, e.mesh.position) < 24) {
          if (this.enemies.damage(e, 999)) this._killEnemy(e);
        }
      }
      this.effects.shockwave(this.player.pos.x, this.player.pos.z, CONFIG.colors.red, 26, 30);
      this.hud.banner("💥 PURGE", "Bugs gelöscht");
    } else if (type === "heal") {
      this.player.hp = this.player.maxHp;
      this.hud.setHp(this.player.hp, this.player.maxHp);
      this.hud.banner("❤️ HEILUNG", "Voll regeneriert");
    } else {
      this.buffs[type] = meta.dur;
      this.hud.banner(meta.icon + " " + meta.label, meta.dur + "s aktiv");
    }
  }

  _updateBuffs(dt) {
    for (const id of TIMED_IDS) {
      if (this.buffs[id] > 0) this.buffs[id] = Math.max(0, this.buffs[id] - dt);
    }
    if (this.buffs.shield > 0) this.player.invuln = Math.max(this.player.invuln, 0.15);
    const list = [];
    for (const id of TIMED_IDS) {
      if (this.buffs[id] > 0) {
        list.push({ icon: POWERUPS[id].icon, ratio: this.buffs[id] / POWERUPS[id].dur });
      }
    }
    this.hud.setBuffs(list);
  }

  // Lucky-Drop: zufällige Belohnung mit Tamtam.
  _luckyReward() {
    this.audio.levelUp();
    this.hud.flash("#ff6ec7", 0.4);
    this.effects.burst(this.player.pos.x, this.player.pos.z, CONFIG.colors.pink, 24, 1.4);
    const roll = Math.random();
    if (roll < 0.35) {
      const amt = 30 + Math.floor(Math.random() * 40);
      this.coins += amt;
      this.hud.setCoins(this.coins);
      this.hud.banner("🍀 LUCKY", "+" + amt + " Coins");
    } else if (roll < 0.6) {
      this.player.hp = this.player.maxHp;
      this.hud.setHp(this.player.hp, this.player.maxHp);
      this.hud.banner("🍀 LUCKY", "Voll geheilt");
    } else if (roll < 0.85) {
      const item = rollItem();
      this.inventory.add(item);
      this.hud.banner("🍀 LUCKY", item.icon + " " + item.name);
      if (this.invOpen) this._renderInv();
    } else {
      // Kein Zwangs-Waffentausch mehr: Lucky-Drops nehmen nie die gewaehlte Waffe
      // weg. Stattdessen ein Coin-Jackpot – bleibt belohnend, aendert aber nichts
      // an der Ausruestung.
      const amt = 70 + Math.floor(Math.random() * 60);
      this.coins += amt;
      this.hud.setCoins(this.coins);
      this.hud.banner("🍀 LUCKY-JACKPOT", "+" + amt + " Coins");
    }
  }

  // ------------------------------------------------------------- Ultimate --
  _activateUltimate() {
    this.ultActive = true;
    this.ultReady = false;
    this.ultTimer = CONFIG.combo.ultDuration;
    this.audio.ultimate();
    this.world.addShake(0.9);
    this.world.setCamera({ x: 0, y: 30, z: 7 }); // dramatische Top-down-Perspektive
    this.hud.flash("#6ee7ff", 0.45);
    this.effects.shockwave(this.player.pos.x, this.player.pos.z, CONFIG.colors.cyan, 14, 26);
    this.hud.banner("ERKLÄR'S DER ENTE", "Bugs werden sichtbar");

    for (const e of [...this.enemies.enemies]) {
      if (!e.alive) continue;
      if (distXZ(this.player.pos, e.mesh.position) < 12) {
        if (this.enemies.damage(e, 2)) this._killEnemy(e);
      }
    }
  }

  _endUltimate() {
    this.ultActive = false;
    this.ultCharge = 0;
    this.ultTimer = 0;
    this.hud.setUltimate(0, false);
    this.world.resetCamera();
  }

  // ---------------------------------------------------------------- Combo --
  _updateCombo(dt) {
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this._breakCombo();
    }
  }

  _breakCombo() {
    this.combo = 0;
    this.comboMult = 1;
    this.hud.setCombo(1);
  }

  // ------------------------------------------------------------- Level-Up --
  _queueLevelUp(n) {
    this.pendingLevels += n;
    this.audio.levelUp();
    this.magnetBoost = 3; // 3s Riesen-Magnet: zieht alle Drops zum Spieler
    this._applyVision(); // Level-Up erweitert den Sicht-Radius (Fog of War)
    // Kosmetik nach Level-Meilensteinen freischalten.
    if (this.progression.level >= 5) this._unlock(() => this.player.addShades(), "SHADES");
    if (this.progression.level >= 10) this._unlock(() => this.player.addCape(), "CAPE");
    if (!this.levelingUp) this._openLevelUp();
  }

  // Sicht-Radius aus dem Level berechnen und setzen (Fog of War, upgradebar).
  _applyVision() {
    const v = CONFIG.vision || { base: 30, perLevel: 4, max: 80 };
    const range = Math.min(v.max, v.base + (this.progression.level - 1) * v.perLevel);
    this.world.setVision?.(range);
  }

  // Kosmetik freischalten: fn() gibt true zurück, wenn neu → Effekt + Banner.
  _unlock(fn, label) {
    if (fn()) {
      this.effects.burst(this.player.pos.x, this.player.pos.z, CONFIG.colors.cyan, 24, 1.4);
      this.hud.banner("KOSMETIK FREI", label);
    }
  }

  _openLevelUp() {
    this.levelingUp = true;
    const choices = this.progression.roll(3);

    // Mit Wahrscheinlichkeit eine Waffe statt einer Fähigkeit anbieten.
    const others = WEAPON_IDS.filter((id) => id !== this.weaponId);
    if (others.length && Math.random() < 0.45) {
      const w = WEAPONS[others[Math.floor(Math.random() * others.length)]];
      choices[choices.length - 1] = {
        icon: w.icon, name: "Waffe: " + w.name, desc: w.desc, weaponId: w.id,
      };
    }

    this.hud.showLevelUp(this.progression.level, choices, (i) =>
      this._pickChoice(choices, i)
    );
  }

  _pickChoice(choices, i) {
    const c = choices[i];
    if (c.weaponId) {
      this._setWeapon(c.weaponId);
      this.hud.banner("NEUE WAFFE", WEAPONS[c.weaponId].name);
    } else {
      c.apply(this.upgradeMods, this.player, this);
      this._recomputeMods();
      this._syncStats();
      this.hud.banner("UPGRADE", c.name);
      if (c.id === "maxhp") this._unlock(() => this.player.addHelmet(), "HELM");
    }
    this.hud.setHp(this.player.hp, this.player.maxHp);

    this.pendingLevels--;
    if (this.pendingLevels > 0) this._openLevelUp();
    else { this.levelingUp = false; this.hud.hideLevelUp(); }
  }

  _setWeapon(id) {
    this.weaponId = id;
    this.weapon = WEAPONS[id];
    this.fireTimer = 0;
    this.hud.setWeapon(this.weapon.name, this.weapon.icon);
    this._refreshHeldWeapon();
    // Sichtbare Nahkampf-Optik (Fäuste/Schwert) setzen bzw. entfernen.
    if (this.weapon.melee) this.player.setMeleeVisual?.(id === "fists" ? "fists" : "sword", this.weapon.color);
    else this.player.setMeleeVisual?.(null);
  }

  // Getragenes Waffenmodell an die aktuelle Waffe anpassen (no-op falls Modelle
  // noch nicht geladen → wird nach dem Laden via main.js nachgeholt).
  _refreshHeldWeapon() {
    this.player.setWeaponModel(cloneWeaponModel(this.weaponId));
  }

  // Einen gesperrten Raum mit Coins freischalten (Geld-Sink: die Basis waechst).
  // Bezahlt aus den Run-Coins (aus Deploys verdient); bleibt dauerhaft offen.
  _buyRoom(door) {
    if (!door || !door.locked) return;
    if (this.coins < door.price) {
      this.hud.toast("🪙", "Nicht genug Coins", `${door.label} kostet ${door.price} – starte einen Deploy`);
      this.audio.error?.();
      return;
    }
    if (!this.world.building.unlockDoor(door.name)) return;
    this.coins -= door.price;
    this.hud.setCoins(this.coins);
    if (!this.meta.unlockedRooms.includes(door.name)) {
      this.meta.unlockedRooms.push(door.name); // dauerhaft merken
      this._saveMeta();
    }
    this.audio.buy?.();
    this.guide.event("roomUnlocked");
    this.hud.banner("RAUM FREIGESCHALTET", door.label);
    this.effects.burst(door.cx, door.cz, CONFIG.colors.cyan, 26, 1.5);
    this.world.addShake(0.25);
    this.hud.flash("#6ee7ff", 0.3);
  }

  // ----------------------------------------------------------------- Boons --
  // 1 aus 3 build-definierende Run-Boons anbieten (pausiert den Run).
  _offerBoon() {
    this.boonChoosing = true;
    this.audio.levelUp?.();
    this._boonChoices = rollBoons(3);
    this.hud.showBoons(this._boonChoices, (i) => this._pickBoon(i));
  }

  _pickBoon(i) {
    const c = this._boonChoices?.[i];
    if (!c) return;
    this.boons.push(c.id);
    this.audio.buy();
    if (c.mods) mergeMods(this.boonMods, c.mods);
    if (c.special === "lifesteal") this.boonFlags.lifesteal += c.amount || 2;
    else if (c.special === "coinMult") this.boonFlags.coinMult *= c.amount || 1.5;
    else if (c.special === "drone") this.automation.spawnExtraDrone();
    this._recomputeMods();
    this._syncStats();
    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.hud.banner("✨ BOON", c.icon + " " + c.name);
    this.world.addShake(0.2);
    this.effects.burst(this.player.pos.x, this.player.pos.z, CONFIG.colors.pink, 22, 1.3);
    this.hud.setBoonList(this.boons.map((id) => BOONS[id]));
    this.boonChoosing = false;
    this.hud.hideBoons();
  }

  // Ziel-Anzeige: aktueller Sektor + nächste Boss-Welle (oder Endlos nach Sieg).
  _updateObjective(n) {
    const be = CONFIG.waves.bossEvery;
    const sectors = CONFIG.campaign.sectors;
    if (this._gateBreached) return; // PC-Integrität wird live angezeigt – nicht überschreiben
    if (this.won) { this.hud.setObjective("🏆 Mainboard befreit · Endlos-Modus"); return; }
    const sector = Math.min(sectors, Math.floor((n - 1) / be) + 1);
    const name = CONFIG.campaign.sectorNames[sector - 1] || ("Sektor " + sector);
    const nextBoss = Math.ceil(n / be) * be;
    const anom = this.sectorMod ? ` · ${this.sectorMod.icon} ${this.sectorMod.name}` : "";
    this.hud.setObjective(`🎯 Sektor ${sector}/${sectors} · ${name} · Boss Welle ${nextBoss}${anom}`);
  }

  // Waffe im Armory-Raum kaufen + sofort ausrüsten (Run-Coins).
  _buyWeapon(pad) {
    if (this.weaponId === pad.id) return;
    const req = WEAPON_LEVEL[pad.id] || 2;
    if (this.progression.level < req) {
      this.hud.toast("🔒", "Level zu niedrig", `${WEAPONS[pad.id].name} ab Lvl ${req} (du: Lvl ${this.progression.level})`);
      this.audio.error?.();
      return;
    }
    if (this.coins < pad.price) {
      this.hud.toast("🪙", "Nicht genug Coins", `${WEAPONS[pad.id].name} kostet ${pad.price}`);
      this.audio.error?.();
      return;
    }
    this.coins -= pad.price;
    this.hud.setCoins(this.coins);
    this._setWeapon(pad.id);
    this.hud.banner("WAFFE GEKAUFT", WEAPONS[pad.id].name);
    this.audio.buy();
    this.effects.burst(this.player.pos.x, this.player.pos.z, this.weapon.color, 20, 1.2);
    this.world.addShake(0.2);
  }

  // Idle-Helfer im Labor kaufen (Drohne/Reparatur/Sammler).
  _buyAutomation(pad) {
    const id = pad.id;
    if (this.automation.isMax(id)) { this.hud.toast("✅", "Maximal ausgebaut", this.automation.nameFor(id)); return; }
    const price = this.automation.priceFor(id);
    if (this.coins < price) {
      this.hud.toast("🪙", "Nicht genug Coins", `${this.automation.nameFor(id)} kostet ${price}`);
      this.audio.error?.();
      return;
    }
    this.coins -= price;
    this.hud.setCoins(this.coins);
    this.automation.apply(id);
    this.hud.banner("AUTOMATION", this.automation.nameFor(id) + " Lv" + this.automation.levels[id]);
    this.audio.buy();
    this.effects.burst(this.player.pos.x, this.player.pos.z, 0x80ed99, 18, 1.0);
  }

  // ----------------------------------------------------------------- Waves --
  _spawnEnemy(type) {
    const { x, z } = edgeSpawn(this.world.arenaHalf);
    this.enemies.spawn(type, x, z);
  }

  _checkAch() {
    const got = this.achievements.check(this.runStats);
    for (const a of got) {
      this.hud.toast(a.icon, "Achievement: " + a.name, a.desc);
      this.audio.levelUp();
    }
  }

  _onWaveStart(n) {
    this.hud.setWave(n);
    this.audio.waveStart();
    this.runStats.wave = n;
    this._updateObjective(n);
    this._checkAch();

    // Schwierigkeit skaliert mit der Welle.
    const d = CONFIG.difficulty;
    this.enemies.hpScale = 1 + (n - 1) * d.hpPerWave;
    this.enemies.speedScale = Math.min(d.speedMax, 1 + (n - 1) * d.speedPerWave);

    // Arena wächst.
    const half = Math.min(d.arenaMax, CONFIG.arena.half + (n - 1) * d.arenaGrowth);
    this.world.setArena(half);
    this.player.arenaHalf = half;

    // Stimmungs-Tint je Sektor – hell & freundlich (ORAS), nur leichte Variation.
    if (n === 6) {
      this.world.setBackdrop("./assets/textures/office_bg2.png");
      this.world.setMood(0xc9d9e8); // Sektor 2: kühles Tageslicht-Blau
    } else if (n === 11) {
      this.world.setBackdrop("./assets/textures/office_bg3.png");
      this.world.setMood(0xe2d8c8); // Sektor 3: warmes Nachmittags-Beige
    } else if (n === 16) {
      this.world.setMood(0xd6cce4); // Sektor 4: sanftes Lavendel
    } else if (n === 21) {
      this.world.setMood(0xf0d6cc); // Sektor 5: warmes Abendlicht
    }

    if (n % CONFIG.waves.bossEvery === 0) {
      this._startBossIntro(n); // Cinematic: Zoom auf Monitor → Bug springt raus
    } else {
      this.hud.banner("WELLE " + n, "Bugs eingehend…");
      // Alle 3 Wellen (außer Boss-Wellen) einen Run-Boon zur Wahl stellen.
      if (n > 1 && n % 3 === 0) this.boonPending = true;
    }
  }

  // Welcher Boss erscheint in Welle n? (1 pro Sektor, je eigenes Angriffsmuster)
  _bossKeyForWave(n) {
    const keys = ["boss", "bossNull", "bossStack", "bossRace", "bossFinal"];
    const sector = Math.floor(n / CONFIG.waves.bossEvery); // 1..5
    return keys[Math.min(keys.length - 1, Math.max(0, sector - 1))];
  }

  _startBossIntro(n) {
    this.bossIntro = true;
    this.intro = { t: 0, n, shown: false, spawned: false, key: this._bossKeyForWave(n) };
    this.world.setCamera({ x: 0, y: 6, z: 14 }); // Blick Richtung Monitor
    this.audio.waveStart();
  }

  // Boss-Intro: kurz auf den Monitor zoomen, Claude-Fenster zeigen,
  // dann springt der Bug aus dem Rechner und erscheint als Gegner.
  _updateIntro(dt) {
    const I = this.intro;
    I.t += dt;
    const monitorPos = { x: 0, y: 5, z: -44.5 }; // Monitor im Shop-Raum
    this.world.updateCamera(monitorPos, dt);

    const def = CONFIG.enemies[I.key] || CONFIG.enemies.boss;
    if (!I.shown) { I.shown = true; this.hud.showBossIntro(def.label.toUpperCase()); }

    if (I.t > 2.6 && !I.spawned) {
      I.spawned = true;
      this.hud.hideBossIntro();
      this.hud.flash("#ff8c1a", 0.5);
      const half = this.world.arenaHalf;
      this.boss = this.enemies.spawn(I.key, 0, -(half - 3));
      this.boss.bossWave = I.n; // für die wellenabhängige Angriffs-Skalierung
      this._bossPhase = 1; // Phasen-System: eskaliert mit sinkender Boss-HP
      this.audio.bossAppear();
      this.world.addShake(1.0);
      this._freeze(0.1);
      this.effects.shockwave(0, -(half - 3), def.glow, 18, 26);
      this.effects.burst(0, -(half - 3), def.glow, 30, 1.6);
      this.hud.banner("⚠ " + def.label.toUpperCase(), "springt aus dem Rechner!");
      this.world.setCamera({ x: 0, y: 13, z: 20 });
    }
    if (I.t > 3.3) { this.bossIntro = false; this.intro = null; }
  }

  // Deploy-Terminal (E) als TOGGLE: einmal an → Wellen laufen in Dauerschleife,
  // nochmal → Schleife stoppt (laufende Gegner bleiben, aber keine neuen Wellen).
  startDefense() {
    if (this.bossIntro) return;
    this.defenseLoop = !this.defenseLoop;
    if (this.defenseLoop) {
      if (this.waves.state === "break") this.waves.beginNow();
      this.guide.event("deployStarted");
      this.audio.buy?.();
      this.world.addShake(0.15);
      this.hud.flash("#ff5470", 0.3);
      this.hud.banner("⚔️ BUGS INCOMING", "Beschütze das Tor – los, Kampf-Ente!");
    } else {
      this.hud.banner("⏸ Pause", "Keine neuen Wellen mehr");
    }
  }

  _onWaveClear(n) {
    this.audio.yay();
    this.player.hp = clamp(this.player.hp + 15, 0, this.player.maxHp);
    this.hud.setHp(this.player.hp, this.player.maxHp);
    // Coin-Belohnung pro Welle (die Schleife läuft weiter, bis man sie ausschaltet).
    const reward = 25 + n * 10;
    this.coins += reward;
    this.hud.setCoins(this.coins);
    this.hud.banner("WELLE " + n + " CLEAR", "+" + reward + " 🪙 · nächste kommt…");
    this.guide.event("waveCleared");
    this.hud.toast("📝", "Patch Notes", PATCH_NOTES[Math.floor(Math.random() * PATCH_NOTES.length)]);
    this._saveMeta(); // gesammelte Daten (permanent) sichern
    // Nach der ersten Welle: Schwert wählen (löst die Fäuste ab).
    if (!this._swordChosen) { this._swordChosen = true; this._offerDraft(); }
  }

  _popup(worldPos, text, color, kind = "") {
    const v = new THREE.Vector3(worldPos.x, 1.5, worldPos.z).project(this.world.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.hud.popup(x, y, text, color, kind);
  }
}
