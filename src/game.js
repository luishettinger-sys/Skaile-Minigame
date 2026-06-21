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
import { WEAPONS, WEAPON_IDS, WEAPON_PRICE } from "./weapons.js";
import { Armory } from "./armory.js";
import { cloneWeaponModel } from "./weaponmodels.js";
import { Automation } from "./automation.js";
import { Inventory } from "./inventory.js";
import { Stations } from "./stations.js";
import { EnemyShots } from "./enemyshots.js";
import { Throwables } from "./throwables.js";
import { rollItem, defaultMods, mergeMods } from "./items.js";
import { POWERUPS, POWER_IDS, TIMED_IDS } from "./powerups.js";
import { GADGETS, GADGET_IDS, gadgetPrice } from "./gadgets.js";
import { SKINS } from "./skins.js";
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
    const def = { coins: 0, bestWave: 1, kills: 0, ownedSkins: ["classic"], equippedSkin: "classic", upgrades: {}, sectorsCleared: 0, won: false, unlockedRooms: [], guideSeen: false };
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
    const mode = this._skinMode || "bank";
    const balance = mode === "run" ? this.coins : this.meta.coins;
    this.hud.renderSkins(this.meta, balance, mode, (k) => this.buySkin(k), (k) => this.equipSkin(k));
  }

  buySkin(key) {
    const def = SKINS[key];
    if (!def || this.meta.ownedSkins.includes(key)) return;
    const mode = this._skinMode || "bank";
    if (mode === "run") {
      if (this.coins < def.price) { this.hud.toast?.("Nicht genug Coins 🪙"); return; }
      this.coins -= def.price;
      this.hud.setCoins(this.coins);
      if (this.shopOpen) this._renderShop();
    } else {
      if (this.meta.coins < def.price) { this.hud.toast?.("Nicht genug Bank 🪙"); return; }
      this.meta.coins -= def.price;
    }
    this.meta.ownedSkins.push(key);
    this._saveMeta();
    this.audio.buy();
    this.equipSkin(key); // direkt anlegen
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
    this.weaponId = "blaster";
    this.weapon = WEAPONS.blaster;
    this.upgradeMods = defaultMods(); // aus Level-Up-Upgrades
    this.equipMods = defaultMods(); // aus ausgerüsteten Items
    this._recomputeMods();
    this._refreshHeldWeapon();
  }

  // Effektive Mods = Upgrades kombiniert mit Ausrüstung.
  _recomputeMods() {
    const m = defaultMods();
    mergeMods(m, this._metaMods()); // permanente Lab-Ausbauten zuerst
    mergeMods(m, this.boonMods); // Run-Boons
    mergeMods(m, this.upgradeMods);
    mergeMods(m, this.equipMods);
    mergeMods(m, this._gadgetMods());
    this.mods = m;
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
    return this.weapon.fireInterval * this.mods.fireMult * (this.buffs.rapid > 0 ? 0.5 : 1);
  }
  _damage() {
    return (this.weapon.damage + this.mods.dmgAdd) * this.mods.dmgMult * (this.buffs.double > 0 ? 2 : 1);
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
    this.bossIntro = false;
    this.intro = null;
    this.buffs = { rapid: 0, double: 0, shield: 0, slow: 0 };
    this.gadgets = {}; // id -> Stufe
    this.activeGadget = null;
    this.carrying = null; // aktuell getragenes Wurfobjekt
    this.bonusT = 22; // Timer bis zum nächsten Bonus-Bug
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
    this.enemyShots.reset();
    this.throwables.reset();
    this.carrying = null;
    this.waves.reset();
    this.defenseActive = false; // Wellen sind opt-in: erst per Deploy-Terminal starten
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
      return { type: "weapon", id, icon: w.icon, name: w.name, desc: w.desc, price };
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
      else if (door && !this.shopOpen) this._buyRoom(door);
      else if (!this.shopOpen && this._stationNear("vault")) this._useVault();
      else if (!this.shopOpen && this._stationNear("puzzle")) this._startChallenge();
      else if (!this.shopOpen && this.stations.deployNear(this.player.pos)) this.startDefense();
      else if (this.shopOpen || this.stations.shopNear(this.player.pos)) this.toggleShop();
    }
    if (this.input.wasPressed("KeyG")) this.cycleGadget();
    if (this.input.wasPressed("KeyB")) this.audio.toggleMute(); // Mute (war M)

    // Kamera-Perspektive wechseln: Q schaltet zwischen Vogel- und Drohnen-Ansicht.
    if (this.input.wasPressed("KeyQ")) {
      const mode = this.world.toggleCam();
      this.hud.toast("🎥", "Perspektive", mode === 1 ? "Drohne (hinter der Ente)" : "Vogelperspektive");
    }

    if (this.bossIntro) { this._updateIntro(dt); return; }
    // Anstehenden Boon anbieten, sobald keine andere Auswahl offen ist.
    if (this.boonPending && !this.levelingUp && !this.boonChoosing &&
        !this.paused && !this.invOpen && !this.shopOpen) {
      this.boonPending = false;
      this._offerBoon();
    }
    if (this.paused || this.levelingUp || this.invOpen || this.shopOpen || this.boonChoosing) return;

    // Hit-Stop: kurzes Einfrieren für spürbaren Impact.
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      dt *= 0.06;
    }

    this._autoCamera(dt);
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
    if (this.defenseActive && this.bonusT <= 0 && !this.boss) {
      this.bonusT = 22 + Math.random() * 16;
      const { x, z } = edgeSpawn(this.world.arenaHalf);
      this.enemies.spawn("bonus", x, z);
      this.hud.banner("💰 BONUS BUG", "Schnapp ihn dir!");
    }

    // Riesen-Magnet nach Level-Up läuft ab.
    if (this.magnetBoost > 0) this.magnetBoost = Math.max(0, this.magnetBoost - dt);

    // Debug-Challenge (Rätselraum): Timer + Cooldown.
    if (this._challengeCD > 0) this._challengeCD = Math.max(0, this._challengeCD - dt);
    if (this._challengeActive) {
      this._challengeTimer -= dt;
      if (this._challengeTimer <= 0) {
        this._challengeActive = false;
        this.hud.banner("CHALLENGE VORBEI", "Gut gedebuggt! 🐞");
      }
    }

    // Gelegentlicher Rubber-Duck-Tipp.
    this.tipT -= dt;
    if (this.tipT <= 0) {
      this.tipT = 24 + Math.random() * 16;
      this.hud.toast("🦆", "Rubber Duck", DUCK_TIPS[Math.floor(Math.random() * DUCK_TIPS.length)]);
    }

    // Wellen laufen nur während eines aktiven Deploys (opt-in). Im Bau-Modus
    // ist es ruhig – die Basis-Verwaltung ist der Kern, Kämpfe sind optional.
    if (this.defenseActive) this.waves.update(dt, this.enemies.aliveCount());
    this.enemies.update(enemyDt, this.player.pos, this.ultActive, {
      shoot: (x, z, dx, dz, o) => this.enemyShots.spawn(x, z, dx, dz, o),
    });
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
        this.throwables.throwItem(this.carrying, Math.sin(this.player.facing), Math.cos(this.player.facing));
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
      this.hud.showPrompt(owned ? `${WEAPONS[pad.id].name} (ausgerüstet)` : `[E] ${WEAPONS[pad.id].name} – ${pad.price} 🪙`);
    }
    else if (this.stations.shopNear(this.player.pos)) this.hud.showPrompt("[E] SHOP");
    else if (this.world.building?.lockedDoorNear?.(this.player.pos.x, this.player.pos.z)) {
      const d = this.world.building.lockedDoorNear(this.player.pos.x, this.player.pos.z);
      this.hud.showPrompt(`[E] 🔒 ${d.label} freischalten – ${d.price} 🪙`);
    }
    else if (this._stationNear("vault")) this.hud.showPrompt(`[E] 🏦 Bank: ${this.coins} 🪙 einzahlen + Skins`);
    else if (this._stationNear("puzzle")) this.hud.showPrompt(this._challengeActive ? "🐞 Debug-Challenge läuft!" : "[E] 🐞 Debug-Challenge starten (Bonus-Coins)");
    else if (this.stations.deployNear(this.player.pos)) {
      this.hud.showPrompt(this.defenseActive ? "🚀 Deploy läuft… Bugs abwehren!" : "[E] 🚀 DEPLOY – Bug-Welle starten (Coins)");
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
      this.hud.setBoss(this.boss.hp / this.boss.maxHp, this.boss.def.label);
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

    this.world.updateCamera(this.player.pos, dt, this.player.facing);
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
  // Blickrichtung: standardmäßig in Laufrichtung. Beim Schießen dreht sich die
  // Ente kurz zum nächsten Gegner (damit Schüsse treffen), danach zurück zur
  // Laufrichtung – kein „läuft geradeaus, guckt aber zur Seite".
  _updateFacing(dt, move) {
    const target = this._nearestEnemy(CONFIG.energy.aimRange);
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

  // -------------------------------------------------------------- Combat --
  _fireWeapon(dt) {
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
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      const ang = baseAng + off;
      const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
      const origin = {
        x: this.player.pos.x + dir.x * fwd,
        z: this.player.pos.z + dir.z * fwd,
      };
      // Orbit-Waffen: Geschosse gleichmäßig auf den Kreis verteilen.
      if (w.behavior === "orbit") opts.orbitAng = (i / n) * Math.PI * 2 + baseAng;
      this.projectiles.spawn(origin, dir, opts);
    }
    this.audio.weapon(this.weapon.sound);
    this.player.kickWeapon(); // Rückstoß der getragenen Waffe (Wucht/„Feel")
    // Mündungsblitz in Waffenfarbe (glühender Funke).
    this.effects.burst(
      this.player.pos.x + Math.sin(this.player.facing) * fwd,
      this.player.pos.z + Math.cos(this.player.facing) * fwd,
      this.weapon.color, 6, 0.55
    );
    this.player.recoil?.(); // Waffe zurückstoßen + Aim-Pose
    this.world.addShake(0.05);
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
          if (crit) {
            this._popup(e.mesh.position, "CRIT", "#ff5470");
            this.world.addShake(0.14);
          }
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
        if (!this.player.alive) { this.gameOver(); return; }
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
          if (!this.player.alive) { this.gameOver(); return; }
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
          if (!this.player.alive) { this.gameOver(); return; }
        }
        this.enemyShots.retire(i);
      }
    }
  }

  _killEnemy(e) {
    this.enemies.kill(e);
    this.audio.killSound(this.combo);
    this.effects.burst(e.mesh.position.x, e.mesh.position.z, e.def.color, e.def.isBoss ? 40 : 16, e.def.isBoss ? 1.8 : 1.1);
    this.world.addShake(e.def.isBoss ? 1.0 : 0.26);

    this.combo++;
    this.comboTimer = CONFIG.combo.decayTime;
    this.comboMult = 1 + Math.floor(this.combo / 5);
    const gained = e.def.score * this.comboMult;
    this.score += gained;
    this.hud.setScore(Math.floor(this.score));
    this.hud.setCombo(this.comboMult);
    this._popup(e.mesh.position, "+" + gained, "#ffd23f");

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
    this.coins += Math.max(1, Math.round((e.def.score / 15) * this.boonFlags.coinMult));
    this.hud.setCoins(this.coins);

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
        isFinal ? "🏆 GEBÄUDE BEFREIT" : `SEKTOR ${Math.min(sector, CONFIG.campaign.sectors)}/${CONFIG.campaign.sectors} GESÄUBERT`,
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

      // Großes Ziel: letzter Sektor gesäubert → Sieg (Run kann weiterlaufen).
      if (this.waves.wave >= CONFIG.campaign.finalWave && !this.won) {
        this._victory();
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

  _collect(kind, value) {
    if (kind === "gem") {
      this.audio.pickup();
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
      this.audio.pickup();
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
    if (this.won) { this.hud.setObjective("🏆 Gebäude befreit · Endlos-Modus"); return; }
    const sector = Math.min(sectors, Math.floor((n - 1) / be) + 1);
    const name = CONFIG.campaign.sectorNames[sector - 1] || ("Sektor " + sector);
    const nextBoss = Math.ceil(n / be) * be;
    this.hud.setObjective(`🎯 Sektor ${sector}/${sectors} · ${name} · Boss Welle ${nextBoss}`);
  }

  // Waffe im Armory-Raum kaufen + sofort ausrüsten (Run-Coins).
  _buyWeapon(pad) {
    if (this.weaponId === pad.id) return;
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

  // Opt-in: Eine Deploy-Welle starten (am Deploy-Terminal mit E). Während ein
  // Deploy läuft, kein erneuter Start; Boss-Intro blockiert ebenfalls.
  startDefense() {
    if (this.defenseActive || this.bossIntro) return;
    this.defenseActive = true;
    this.waves.beginNow();
    this.guide.event("deployStarted");
    this.audio.buy?.();
    this.world.addShake(0.15);
    this.hud.flash("#2bd4ff", 0.3);
  }

  _onWaveClear(n) {
    this.audio.yay();
    this.player.hp = clamp(this.player.hp + 15, 0, this.player.maxHp);
    this.hud.setHp(this.player.hp, this.player.maxHp);
    // Deploy beendet → zurück in den ruhigen Bau-Modus (keine Auto-Folgewelle).
    this.defenseActive = false;
    // Coin-Belohnung skaliert mit der Welle → Deploys lohnen sich fürs Bauen.
    const reward = 25 + n * 10;
    this.coins += reward;
    this.hud.setCoins(this.coins);
    this.hud.banner("DEPLOY OK · WELLE " + n, "Build grün – +" + reward + " 🪙");
    this.guide.event("waveCleared");
    this.hud.toast("📝", "Patch Notes", PATCH_NOTES[Math.floor(Math.random() * PATCH_NOTES.length)]);
  }

  _popup(worldPos, text, color) {
    const v = new THREE.Vector3(worldPos.x, 1.5, worldPos.z).project(this.world.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.hud.popup(x, y, text, color);
  }
}
