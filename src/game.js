// Game-Orchestrator: verbindet alle Systeme, hält den Spielzustand,
// regelt Combat, Combo, das "Rubber Duck Moment"-Ultimate und die Wellen.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { Player } from "./player.js";
import { ProjectileSystem } from "./projectiles.js";
import { EnemySystem, edgeSpawn } from "./enemies.js";
import { Effects } from "./effects.js";
import { WaveManager } from "./waves.js";
import { distXZ, clamp } from "./utils.js";

const STATE = { MENU: "menu", PLAYING: "playing", OVER: "over" };

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

    this.waves = new WaveManager({
      onSpawn: (type) => this._spawnEnemy(type),
      onWaveStart: (n) => this._onWaveStart(n),
      onWaveClear: (n) => this._onWaveClear(n),
    });

    this.state = STATE.MENU;
    this._resetRun();
  }

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
  }

  start() {
    this._resetRun();
    this.player.reset();
    this.projectiles.reset();
    this.enemies.reset();
    this.effects.reset();
    this.waves.reset();
    this.audio.init();
    this.audio.resume();

    this.hud.hideOverlays();
    this.hud.hidePause();
    this.hud.setScore(0);
    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.hud.setUltimate(0, false);
    this.hud.setCombo(1);
    this.state = STATE.PLAYING;
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

  gameOver() {
    this.state = STATE.OVER;
    this.audio.gameOver();
    this.world.addShake(0.8);
    this.effects.burst(this.player.pos.x, this.player.pos.z, CONFIG.colors.duckBody, 30, 1.6);
    this.hud.showGameOver(Math.floor(this.score), this.waves.wave);
  }

  // ----------------------------------------------------------------- Loop --
  update(dt) {
    if (this.state !== STATE.PLAYING) return;

    // Pause umschalten (P oder ESC).
    if (this.input.wasPressed("KeyP") || this.input.wasPressed("Escape")) {
      this.togglePause();
    }
    if (this.paused) return;

    const move = this.input.moveVector();
    this.player.update(dt, move);

    // Ultimate auslösen (Q).
    if (this.input.wasPressed("KeyQ") && this.ultReady && !this.ultActive) {
      this._activateUltimate();
    }

    // Zeit-Skalierung: im "Rubber Duck Moment" läuft die Welt langsamer,
    // die Ente bleibt schnell (klassische Bullet-Time).
    const worldDt = this.ultActive ? dt * CONFIG.combo.ultSlowmo : dt;

    if (this.ultActive) {
      this.ultTimer -= dt;
      if (this.ultTimer <= 0) this._endUltimate();
    }

    this.waves.update(dt, this.enemies.aliveCount());
    this.enemies.update(worldDt, this.player.pos, this.ultActive);
    this.projectiles.update(dt);
    this.effects.update(dt);

    this._fireWeapon(dt);
    this._handleProjectileHits();
    this._handleEnemyContact();
    this._updateCombo(dt);

    this.world.updateCamera(this.player.pos, dt);
  }

  // -------------------------------------------------------------- Combat --
  _fireWeapon(dt) {
    this.fireTimer -= dt;

    // Manuell schießen: Leertaste oder Enter (gehalten feuert im Takt).
    const firing =
      this.input.isDown("Space") ||
      this.input.isDown("Enter") ||
      this.input.isDown("NumpadEnter");
    if (!firing || this.fireTimer > 0) return;

    this.fireTimer = CONFIG.weapon.fireInterval * (this.ultActive ? 0.5 : 1);

    // In Blickrichtung der Ente feuern.
    const dir = new THREE.Vector3(
      Math.sin(this.player.facing),
      0,
      Math.cos(this.player.facing)
    );
    const fwd = CONFIG.weapon.muzzleForward;
    const origin = {
      x: this.player.pos.x + dir.x * fwd,
      z: this.player.pos.z + dir.z * fwd,
    };
    this.projectiles.spawn(origin, dir);
    this.audio.shoot();
    this.effects.burst(origin.x, origin.z, CONFIG.colors.projectile, 4, 0.5);
    this.world.addShake(0.05);
  }

  _handleProjectileHits() {
    const list = this.projectiles.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      for (const e of this.enemies.enemies) {
        if (!e.alive || !e.visible) continue;
        const hitR = CONFIG.weapon.projRadius + e.radius;
        if (distXZ(p.mesh.position, e.mesh.position) <= hitR) {
          const killed = this.enemies.damage(e, CONFIG.weapon.damage);
          this.audio.hit();
          this.effects.burst(e.mesh.position.x, e.mesh.position.z, e.def.glow, 5, 0.7);
          this.projectiles.retire(i);
          if (killed) this._killEnemy(e);
          break;
        }
      }
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
          this.world.addShake(0.5);
          this.effects.shockwave(this.player.pos.x, this.player.pos.z, CONFIG.colors.red, 4, 12);
          this.hud.setHp(this.player.hp, this.player.maxHp);
          this._breakCombo();
          if (!this.player.alive) { this.gameOver(); return; }
        }
        // Gegner zurückstoßen, damit er nicht klebt.
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
    this.effects.burst(e.mesh.position.x, e.mesh.position.z, e.def.color, 16, 1.1);
    this.world.addShake(0.18);

    // Combo + Score.
    this.combo++;
    this.comboTimer = CONFIG.combo.decayTime;
    this.comboMult = 1 + Math.floor(this.combo / 5);
    const gained = e.def.score * this.comboMult;
    this.score += gained;
    this.hud.setScore(Math.floor(this.score));
    this.hud.setCombo(this.comboMult);
    this._popup(e.mesh.position, "+" + gained, "#ffd23f");

    // Ultimate aufladen.
    if (!this.ultActive) {
      this.ultCharge += CONFIG.combo.ultPerKill;
      const ratio = this.ultCharge / CONFIG.combo.ultThreshold;
      if (ratio >= 1 && !this.ultReady) {
        this.ultReady = true;
        this.hud.banner("RUBBER DUCK MOMENT", "[ SPACE ] bereit");
      }
      this.hud.setUltimate(ratio, this.ultReady);
    }

    // Race Condition splittet sich in zwei kleinere Bugs.
    if (e.def.splits) {
      for (let i = 0; i < e.def.splits; i++) {
        const off = (i - 0.5) * 1.6;
        const child = this.enemies.spawn("syntax", e.mesh.position.x + off, e.mesh.position.z + off);
        child.baseScale *= 0.7; // wird vom Update angewandt (Treffer-Punch-System)
        child.radius *= 0.7;
      }
    }
    this.enemies.cull();
  }

  // ------------------------------------------------------------- Ultimate --
  _activateUltimate() {
    this.ultActive = true;
    this.ultReady = false;
    this.ultTimer = CONFIG.combo.ultDuration;
    this.audio.ultimate();
    this.world.addShake(0.6);
    this.effects.shockwave(this.player.pos.x, this.player.pos.z, CONFIG.colors.cyan ?? 0x6ee7ff, 14, 26);
    this.hud.banner("ERKLÄR'S DER ENTE", "Bugs werden sichtbar");

    // Initialer Puls: Schaden an allen sichtbaren Bugs in Reichweite.
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

  // ----------------------------------------------------------------- Waves --
  _spawnEnemy(type) {
    const { x, z } = edgeSpawn();
    this.enemies.spawn(type, x, z);
  }

  _onWaveStart(n) {
    this.hud.setWave(n);
    this.hud.banner("WELLE " + n, "Bugs eingehend…");
    this.audio.waveStart();
  }

  _onWaveClear(n) {
    // Kleine Belohnung: etwas Build-Health zurück.
    this.player.hp = clamp(this.player.hp + 15, 0, this.player.maxHp);
    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.hud.banner("WELLE " + n + " CLEAR", "+15 Build Health");
  }

  // Welt-Position → Bildschirm-Koordinaten für DOM-Popups.
  _popup(worldPos, text, color) {
    const v = new THREE.Vector3(worldPos.x, 1.5, worldPos.z).project(this.world.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.hud.popup(x, y, text, color);
  }
}
