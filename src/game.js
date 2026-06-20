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
import { Progression } from "./progression.js";
import { PickupSystem } from "./pickups.js";
import { WEAPONS, WEAPON_IDS } from "./weapons.js";
import { Inventory } from "./inventory.js";
import { Stations } from "./stations.js";
import { rollItem, defaultMods, mergeMods } from "./items.js";
import { distXZ, clamp, angleLerp } from "./utils.js";

const STATE = { MENU: "menu", PLAYING: "playing", OVER: "over" };
const HISCORE_KEY = "duckdebug_highscore";

export class Game {
  constructor({ world, input, hud, audio }) {
    this.world = world;
    this.input = input;
    this.hud = hud;
    this.audio = audio;

    this.player = new Player(world.scene);
    this.projectiles = new ProjectileSystem(world.scene);
    this.enemies = new EnemySystem(world.scene);
    this.effects = new Effects(world.scene);
    this.pickups = new PickupSystem(world.scene);
    this.progression = new Progression();

    this.inventory = new Inventory();
    this.stations = new Stations(world.scene);

    // Höhen-Sampling (Plattformen) an Spieler & Gegner geben.
    this.player.terrain = world.terrain;
    this.enemies.terrain = world.terrain;

    this.waves = new WaveManager({
      onSpawn: (type) => this._spawnEnemy(type),
      onWaveStart: (n) => this._onWaveStart(n),
      onWaveClear: (n) => this._onWaveClear(n),
    });

    this.highscore = Number(localStorage.getItem(HISCORE_KEY)) || 0;
    this.state = STATE.MENU;
    this._resetRun();
  }

  // Waffe + additive/multiplikative Upgrade-Modifikatoren.
  _initLoadout() {
    this.weaponId = "blaster";
    this.weapon = WEAPONS.blaster;
    this.upgradeMods = defaultMods(); // aus Level-Up-Upgrades
    this.equipMods = defaultMods(); // aus ausgerüsteten Items
    this._recomputeMods();
  }

  // Effektive Mods = Upgrades kombiniert mit Ausrüstung.
  _recomputeMods() {
    const m = defaultMods();
    mergeMods(m, this.upgradeMods);
    mergeMods(m, this.equipMods);
    this.mods = m;
  }

  // Ausrüstung neu berechnen und anwenden (nach Equip/Unequip).
  _applyEquipment() {
    this.equipMods = this.inventory.computeMods();
    this._recomputeMods();
    this._syncStats();
  }

  // Effektive Kampfwerte aus Waffe + Mods.
  _fireInterval() { return this.weapon.fireInterval * this.mods.fireMult; }
  _damage() { return (this.weapon.damage + this.mods.dmgAdd) * this.mods.dmgMult; }
  _projCount() { return this.weapon.projCount + this.mods.projAdd; }
  _pierce() { return this.weapon.pierce + this.mods.pierceAdd; }
  _projScale() { return this.weapon.projScale * this.mods.projScaleMult; }
  _moveSpeed() { return CONFIG.player.speed * this.mods.moveSpeedMult; }
  _magnet() { return CONFIG.pickups.magnet * this.mods.magnetMult; }
  _maxHp() { return CONFIG.player.maxHp + this.mods.maxHpAdd; }
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
    this.waves.reset();
    this.audio.init();
    this.audio.resume();
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
    this.world.resetCamera();
    this.state = STATE.PLAYING;
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

  gameOver() {
    this.state = STATE.OVER;
    this.audio.gameOver();
    this.world.addShake(0.8);
    this.effects.burst(this.player.pos.x, this.player.pos.z, CONFIG.colors.duckBody, 30, 1.6);

    const score = Math.floor(this.score);
    if (score > this.highscore) {
      this.highscore = score;
      localStorage.setItem(HISCORE_KEY, String(score));
    }
    this.hud.showGameOver(score, this.waves.wave, this.highscore);
  }

  // ----------------------------------------------------------------- Loop --
  update(dt) {
    if (this.state !== STATE.PLAYING) return;

    if (this.input.wasPressed("KeyP") || this.input.wasPressed("Escape")) {
      this.togglePause();
    }
    if (this.input.wasPressed("KeyI") || this.input.wasPressed("Tab")) {
      this.toggleInventory();
    }
    if (this.paused || this.levelingUp || this.invOpen) return;

    // Hit-Stop: kurzes Einfrieren für spürbaren Impact.
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      dt *= 0.06;
    }

    this._autoAim(dt);
    this._autoCamera(dt);
    const move = this.input.moveVector();

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

    if (this.input.wasPressed("KeyQ") && this.ultReady && !this.ultActive) {
      this._activateUltimate();
    }
    const worldDt = this.ultActive ? dt * CONFIG.combo.ultSlowmo : dt;
    if (this.ultActive) {
      this.ultTimer -= dt;
      if (this.ultTimer <= 0) this._endUltimate();
    }

    this.waves.update(dt, this.enemies.aliveCount());
    this.enemies.update(worldDt, this.player.pos, this.ultActive);
    this.projectiles.update(dt);
    this.effects.update(dt);
    this.pickups.update(dt, this.player.pos, this._magnet(), (kind, value) =>
      this._collect(kind, value)
    );

    // Stationen: auf Feld stehen → Energie/Heilung.
    this.stations.update(dt);
    const st = this.stations.activeAt(this.player.pos);
    if (st === "recharge") {
      this.energy = Math.min(CONFIG.energy.max, this.energy + 90 * dt);
      this.hud.setEnergy(this.energy / CONFIG.energy.max);
    } else if (st === "repair") {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12 * dt);
      this.hud.setHp(this.player.hp, this.player.maxHp);
    }

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

    this.world.updateCamera(this.player.pos, dt);
  }

  // Automatischer Perspektivwechsel (Boss/Ultimate haben Vorrang).
  _autoCamera(dt) {
    if (this.ultActive || this.boss) return;
    if (this.camRevert > 0) {
      this.camRevert -= dt;
      if (this.camRevert <= 0) this.world.resetCamera();
      return;
    }
    this.autoCamT += dt;
    if (this.autoCamT > CONFIG.juice.autoCamInterval) {
      this.autoCamT = 0;
      const v = [{ x: 11, y: 16, z: 10 }, { x: -11, y: 15, z: 12 }, { x: 0, y: 27, z: 6 }];
      this.world.setCamera(v[Math.floor(Math.random() * v.length)]);
      this.camRevert = 3.2;
    }
  }

  // Auto-Ausrichten: Ente schwenkt sanft auf den nächsten Gegner.
  _autoAim(dt) {
    const target = this._nearestEnemy(CONFIG.energy.aimRange);
    this.aimTarget = target;
    if (!target) return;
    const dx = target.mesh.position.x - this.player.pos.x;
    const dz = target.mesh.position.z - this.player.pos.z;
    const want = Math.atan2(dx, dz);
    this.player.facing = angleLerp(this.player.facing, want, CONFIG.energy.aimTurn, dt);
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
    const cost = this.weapon.energyCost;
    if (this.energy < cost) return;
    this.energy -= cost;
    this.sinceShot = 0;
    this.hud.setEnergy(this.energy / CONFIG.energy.max);

    this.fireTimer = this._fireInterval() * (this.ultActive ? 0.5 : 1);

    const n = this._projCount();
    const spread = this.weapon.spread;
    const fwd = CONFIG.weapon.muzzleForward;
    const opts = {
      damage: this._damage(),
      pierce: this._pierce(),
      scale: this._projScale(),
      color: this.weapon.color,
      speed: this.weapon.speed,
      style: this.weapon.style,
    };
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      const ang = this.player.facing + off;
      const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
      const origin = {
        x: this.player.pos.x + dir.x * fwd,
        z: this.player.pos.z + dir.z * fwd,
      };
      this.projectiles.spawn(origin, dir, opts);
    }
    this.audio.weapon(this.weapon.sound);
    this.effects.burst(
      this.player.pos.x + Math.sin(this.player.facing) * fwd,
      this.player.pos.z + Math.cos(this.player.facing) * fwd,
      this.weapon.color, 4, 0.5
    );
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
          const crit = Math.random() < CONFIG.juice.critChance;
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

  _handleEnemyContact() {
    for (const e of this.enemies.enemies) {
      if (!e.alive) continue;
      const hitR = CONFIG.player.radius + e.radius;
      if (distXZ(this.player.pos, e.mesh.position) <= hitR) {
        const hurt = this.player.takeDamage(e.def.damage);
        if (hurt) {
          this.audio.playerHurt();
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

  _killEnemy(e) {
    this.enemies.kill(e);
    this.audio.bugDeath();
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

    if (e.def.isBoss) {
      this.boss = null;
      this.hud.hideBoss();
      this.hud.banner("BOSS BESIEGT", "Kernel restored");
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
    // Kosmetik nach Level-Meilensteinen freischalten.
    if (this.progression.level >= 5) this._unlock(() => this.player.addShades(), "SHADES");
    if (this.progression.level >= 10) this._unlock(() => this.player.addCape(), "CAPE");
    if (!this.levelingUp) this._openLevelUp();
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
  }

  // ----------------------------------------------------------------- Waves --
  _spawnEnemy(type) {
    const { x, z } = edgeSpawn(this.world.arenaHalf);
    this.enemies.spawn(type, x, z);
  }

  _onWaveStart(n) {
    this.hud.setWave(n);
    this.audio.waveStart();

    // Schwierigkeit skaliert mit der Welle.
    const d = CONFIG.difficulty;
    this.enemies.hpScale = 1 + (n - 1) * d.hpPerWave;
    this.enemies.speedScale = Math.min(d.speedMax, 1 + (n - 1) * d.speedPerWave);

    // Arena wächst.
    const half = Math.min(d.arenaMax, CONFIG.arena.half + (n - 1) * d.arenaGrowth);
    this.world.setArena(half);
    this.player.arenaHalf = half;

    if (n % CONFIG.waves.bossEvery === 0) {
      this.boss = this.enemies.spawn("boss", 0, -(half - 3));
      this.hud.banner("⚠ BOSS: KERNEL PANIC", "Welle " + n);
      this.hud.flash("#ff8c1a", 0.35);
      this.world.setCamera({ x: 0, y: 13, z: 20 }); // dramatischer Boss-Blick
    } else {
      this.hud.banner("WELLE " + n, "Bugs eingehend…");
    }
  }

  _onWaveClear(n) {
    this.player.hp = clamp(this.player.hp + 15, 0, this.player.maxHp);
    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.hud.banner("WELLE " + n + " CLEAR", "+15 Build Health");
  }

  _popup(worldPos, text, color) {
    const v = new THREE.Vector3(worldPos.x, 1.5, worldPos.z).project(this.world.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.hud.popup(x, y, text, color);
  }
}
