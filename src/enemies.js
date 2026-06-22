// Bug-Monster: lädt AI-3D-Modelle pro Typ (geklont je Instanz, geteilte
// Buffers) und fällt auf prozedurale Low-Poly-Gegner zurück, falls kein
// Modell vorhanden ist.
import * as THREE from "three";
import { CONFIG } from "./config.js";

const GATE_AGGRO = 9;  // näher am Spieler als das → Bug jagt ihn statt das Tor anzugreifen
const GATE_DPS = 1.0;  // Tor-Schaden/Sek-Faktor pro angreifendem Bug (× def.damage)

export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.enemies = [];
    this.models = {}; // typeKey -> Object3D (GLB-Szene zum Klonen)
    this.hpScale = 1; // pro Welle erhöht (Schwierigkeit)
    this.speedScale = 1;
    this.terrain = null; // wird von Game gesetzt (Höhen-Sampling)
    this._labelMats = {}; // typeKey -> SpriteMaterial (Error-Label)

    this._sharedEye = new THREE.SphereGeometry(0.16, 8, 8);
    this._eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4,
    });
    this._pupilMat = new THREE.MeshBasicMaterial({ color: 0x10131a });

    // Giftige Speicher-Pfützen (Memory-Leak-Spur) – schaden dem Spieler.
    this.hazards = [];
    this._puddleGeo = new THREE.CircleGeometry(1.4, 18);
    this._puddleMat = new THREE.MeshBasicMaterial({
      color: 0x80ed99, transparent: true, opacity: 0.45, depthWrite: false,
    });
  }

  _spawnPuddle(x, z) {
    const gy = this.terrain ? this.terrain.heightAt(x, z) : 0;
    const mesh = new THREE.Mesh(this._puddleGeo, this._puddleMat.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, gy + 0.08, z);
    this.group.add(mesh);
    this.hazards.push({ x, z, r: 1.5, ttl: 4, mesh });
  }

  // Öffentliches Spawn einer Gift-Pfütze (Boss-Gimmick: Rand-Ring in Phase 3).
  spawnHazard(x, z) {
    if (this.hazards.length < 40) this._spawnPuddle(x, z);
  }

  // Steht der Spieler in einer Gift-Pfütze? (für Schaden in game.js)
  hazardAt(x, z) {
    for (const h of this.hazards) if (Math.hypot(x - h.x, z - h.z) < h.r) return true;
    return false;
  }

  // AI-Modell für einen Bug-Typ registrieren (wird je Spawn geklont).
  setModel(typeKey, object3d) {
    this.models[typeKey] = object3d;
  }

  spawn(typeKey, x, z) {
    const def = CONFIG.enemies[typeKey];
    const mesh = this._buildMesh(typeKey, def);
    mesh.position.set(x, def.radius, z);
    this.group.add(mesh);

    // Per-Instanz-Materialien klonen → der weiße Treffer-Blitz trifft nur DIESEN
    // Gegner (gleiche Bug-Typen teilen sonst ein Material und blitzten alle zugleich).
    const flashMats = [];
    mesh.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const arr = Array.isArray(o.material) ? o.material : [o.material];
      const cl = arr.map((m) => m.clone());
      o.material = Array.isArray(o.material) ? cl : cl[0];
      for (const c of cl) {
        if (c.emissive) flashMats.push({ mat: c, em: c.emissive.clone(), ei: c.emissiveIntensity ?? 1 });
        else if (c.color) flashMats.push({ mat: c, col: c.color.clone() });
      }
    });

    // Gefahr-Ring unter Schützen/Springern/Bossen → man sieht klar, welche man
    // priorisieren muss (Skill: Bedrohungen jagen statt random ballern).
    let dangerRing = null;
    if (def.ranged || def.lunger || def.isBoss) {
      dangerRing = new THREE.Mesh(
        new THREE.RingGeometry(def.radius * 1.15, def.radius * 1.6, 28),
        new THREE.MeshBasicMaterial({
          color: def.isBoss ? 0xff1530 : 0xff5a2a, transparent: true, opacity: 0.75,
          side: THREE.DoubleSide, depthWrite: false,
        })
      );
      dangerRing.rotation.x = -Math.PI / 2;
      dangerRing.position.y = -def.radius + 0.08; // auf Bodenhöhe
      mesh.add(dangerRing);
    }

    // Error-Label über dem Bug (eigenes Sprite im Group-Space → ohne Skalierung).
    const label = this._makeLabel(typeKey, def);
    this.group.add(label);

    const hp = Math.max(1, Math.round(def.hp * this.hpScale));
    const enemy = {
      type: typeKey,
      def,
      mesh,
      label,
      hp,
      maxHp: hp,
      speed: def.speed * this.speedScale,
      radius: def.radius,
      alive: true,
      phase: Math.random() * Math.PI * 2,
      visible: true,
      baseScale: mesh.scale.x, // Referenz für den Treffer-Punch
      flash: 0,
      flashMats, // geklonte Materialien für den weißen Treffer-Blitz
      knockX: 0, knockZ: 0, // Treffer-Rückstoß (klingt schnell ab)
      slowT: 0,             // Verlangsamung (Eisschwert)
      atkT: Math.random() * 2, // Angriffs-Timer
      lungeState: "idle", // idle|tele|lunge|cd
      teleT: 0, lungeT: 0, cdT: 0, lvx: 0, lvz: 0,
      _t: 0,
      ttl: def.ttl ?? Infinity, // Bonus-Bug verschwindet nach Zeit
      dangerRing,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  update(dt, targetPos, revealHidden = false, attack = null, gate = null, pc = null) {
    const summons = []; // Boss-Adds, nach der Schleife gespawnt
    for (const e of this.enemies) {
      if (!e.alive) continue;

      // Bonus-Bug verschwindet nach Ablauf (entkommt).
      if (e.ttl !== Infinity) {
        e.ttl -= dt;
        if (e.ttl <= 0) { this.kill(e); continue; }
      }

      const p = e.mesh.position;
      e._atGate = false;
      if (e.slowT > 0) e.slowT = Math.max(0, e.slowT - dt); // Eis-Verlangsamung abbauen

      // Richtung zum Ziel (XZ). Flieht der Gegner, dreht sich die Richtung um.
      const dx = targetPos.x - p.x;
      const dz = targetPos.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const sign = e.def.flee ? -1 : 1;
      const nx = (dx / len) * sign, nz = (dz / len) * sign;
      e._t += dt;

      // --- Typ-spezifischer Bewegungsstil → Gegner sind klar unterscheidbar ---
      let mx = nx, mz = nz;          // default: direkt zum Ziel
      const perpx = -nz, perpz = nx; // senkrecht zur Anflugrichtung
      if (e.def.kite) {
        // Null Pointer: hält Abstand und feuert (zu nah → zurück, zu weit → ran,
        // dazwischen → umkreisen).
        const w = e.def.kite;
        if (len < w - 3) { mx = -nx; mz = -nz; }
        else if (len > w + 5) { mx = nx; mz = nz; }
        else { mx = perpx; mz = perpz; }
      } else if (e.def.orbit && len < (e.def.orbitRange ?? 22)) {
        // Infinite Loop: umkreist den Spieler (tangential + leicht nach innen).
        mx = perpx + nx * 0.32; mz = perpz + nz * 0.32;
        const m = Math.hypot(mx, mz) || 1; mx /= m; mz /= m;
      } else if (e.def.strafe) {
        // Race Condition: webt unberechenbar quer zur Anflugrichtung.
        const s = Math.sin(e._t * 6.5 + e.phase) * e.def.strafe;
        mx = nx + perpx * s; mz = nz + perpz * s;
        const m = Math.hypot(mx, mz) || 1; mx /= m; mz /= m;
      }

      // --- Ziel-Objekt: erst das Tor, nach dessen Durchbruch der PC dahinter.
      //     Ist der Spieler weit weg, marschiert der Bug zum Objekt und knabbert
      //     es an. Bosse/Flieher/Kiter ausgenommen.
      const obj = (gate && gate.alive) ? gate : (pc && pc.alive ? pc : null);
      let gateBound = false;
      if (obj && !e.def.isBoss && !e.def.flee && !e.def.kite && len > GATE_AGGRO) {
        const gx = obj.x - p.x, gz = obj.z - p.z;
        const gl = Math.hypot(gx, gz) || 1;
        mx = gx / gl; mz = gz / gl;
        gateBound = true;
        if (gl <= obj.r + e.radius) {
          obj.damage((e.def.damage || 6) * dt * GATE_DPS);
          e.flash = Math.max(e.flash, 0.5); // Chomp-Blink
          e._atGate = true;
        }
      }

      // --- Fernkampf: schießen ---
      if (e.def.ranged && attack && e.visible) {
        e.atkT -= dt;
        if (e.atkT <= 0 && len < (e.def.shootRange ?? 30)) {
          // Bosse feuern in höheren Phasen schneller (Enrage).
          const phaseRush = e.def.isBoss ? 1 + ((e.phaseLevel || 1) - 1) * 0.4 : 1;
          e.atkT = (e.def.shootInterval ?? 2.2) / phaseRush;
          e.flash = 1; // Mündungsblitz
          if (e.def.isBoss) this._bossAttack(e, p, nx, nz, attack);
          else attack.shoot(p.x, p.z, nx, nz, { color: e.def.glow, speed: 22, damage: 8 });
        }
      }

      // --- Nahkampf: Sprung-Slam (Telegraph → Lunge → Cooldown) ---
      let lunging = false;
      if (e.def.lunger) {
        if (e.lungeState === "tele") {
          e.teleT -= dt;
          e.mesh.scale.setScalar(e.baseScale * (1.2 + Math.sin(e._t * 30) * 0.12));
          if (e.teleT <= 0) { e.lungeState = "lunge"; e.lungeT = 0.32; e.lvx = nx; e.lvz = nz; }
        } else if (e.lungeState === "lunge") {
          e.lungeT -= dt;
          p.x += e.lvx * e.speed * 3.6 * dt;
          p.z += e.lvz * e.speed * 3.6 * dt;
          lunging = true;
          if (e.lungeT <= 0) { e.lungeState = "cd"; e.cdT = e.def.lungeInterval ?? 3; }
        } else if (e.lungeState === "cd") {
          e.cdT -= dt;
          if (e.cdT <= 0) e.lungeState = "idle";
        } else if (len < 17 && Math.random() < dt * 0.7) {
          e.lungeState = "tele";
          e.teleT = 0.5;
        }
      }

      // --- Heisenbug: teleportiert in kurzen Sprüngen statt smooth zu laufen ---
      if (e.def.blink) {
        e.blinkT = (e.blinkT ?? 0.4) - dt;
        if (e.blinkT <= 0 && e.visible) {
          e.blinkT = 0.45 + Math.random() * 0.4;
          const jump = 3 + Math.random() * 3.5;
          const ja = Math.atan2(nx, nz) + (Math.random() - 0.5) * 1.3;
          p.x += Math.sin(ja) * jump;
          p.z += Math.cos(ja) * jump;
          e.flash = Math.max(e.flash, 0.6); // kurzer Blink-Punch
        }
      }
      // --- Normale Bewegung (außer Telegraph/Lunge/Blink/am Tor) ---
      else if (e.lungeState !== "tele" && !lunging && !e._atGate) {
        const step = e.speed * (e.slowT > 0 ? 0.4 : 1) * dt; // Eisschwert verlangsamt
        p.x += mx * step;
        p.z += mz * step;
      }

      // Treffer-Rückstoß (Knockback): kurz wegschieben, schnell abklingen.
      if (e.knockX || e.knockZ) {
        p.x += e.knockX * dt;
        p.z += e.knockZ * dt;
        const kd = Math.exp(-dt * 11);
        e.knockX *= kd; e.knockZ *= kd;
        if (Math.abs(e.knockX) < 0.05) e.knockX = 0;
        if (Math.abs(e.knockZ) < 0.05) e.knockZ = 0;
      }

      e.mesh.rotation.y = gateBound ? Math.atan2(mx, mz) : Math.atan2(dx, dz);

      // Boss beschwört Adds (Stack Smasher / Segfault) – gesammelt, nach der
      // Schleife gespawnt (kein Mutieren während der Iteration).
      if (e.def.summon) {
        e.summonT = (e.summonT ?? e.def.summonInterval ?? 6) - dt;
        if (e.summonT <= 0) {
          e.summonT = e.def.summonInterval ?? 6;
          if (this.aliveCount() < 24) summons.push({ type: e.def.summon, x: p.x, z: p.z });
        }
      }

      // Memory Leak: hinterlässt giftige Speicher-Pfützen.
      if (e.def.leaksTrail && e.visible) {
        e.trailT = (e.trailT ?? 0) - dt;
        if (e.trailT <= 0) {
          e.trailT = e.def.trailInterval ?? 0.6;
          this._spawnPuddle(p.x, p.z);
        }
      }

      // Lebendige Bewegung: Hüpfen, Wackeln, Stufen-Klettern, Flieger schweben.
      e.phase += dt * (6 + e.speed);
      const gy = this.terrain ? this.terrain.heightAt(p.x, p.z) : 0;
      const bounce = Math.abs(Math.sin(e.phase)) * 0.4;
      const fly = e.def.fly ? 1.5 + Math.sin(e.phase * 0.6) * 0.85 : 0;
      p.y = gy + e.def.radius + bounce + fly;
      e.mesh.rotation.z = Math.sin(e.phase * 0.7) * 0.16; // seitliches Wackeln

      // Treffer-Punch: Scale-Pop + weißer Material-Blitz (beides per Instanz).
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt * 7);
        applyFlash(e.flashMats, e.flash); // bei 0 → setzt Material auf Basis zurück
      }
      if (e.lungeState !== "tele") {
        e.mesh.scale.setScalar(e.baseScale * (1 + e.flash * 0.42));
      }

      // Error-Label über dem Bug mitführen.
      e.label.position.set(p.x, p.y + e.def.radius * 2.4 + 0.7, p.z);

      // Gefahr-Ring pulsiert (deutlich sichtbar).
      if (e.dangerRing) {
        const pu = Math.abs(Math.sin(e._t * 4));
        e.dangerRing.material.opacity = 0.5 + pu * 0.45;
      }

      // Heisenbug flackert unsichtbar – außer im "Rubber Duck Moment".
      if (e.def.flickers) {
        const vis = revealHidden || Math.sin(e.phase * 0.8) > -0.3;
        if (vis !== e.visible) {
          e.visible = vis;
          e.mesh.visible = vis;
          e.label.visible = vis;
        }
      }
    }
    // Beschworene Adds spawnen (nach der Iteration).
    for (const s of summons) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 3;
      this.spawn(s.type, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r);
    }

    // Gift-Pfützen altern + ausblenden.
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.ttl -= dt;
      h.mesh.material.opacity = 0.45 * Math.min(1, h.ttl / 1.2);
      if (h.ttl <= 0) { this.group.remove(h.mesh); this.hazards.splice(i, 1); }
    }

    this.cull(); // u.a. abgelaufene Bonus-Bugs entfernen
  }

  // Boss-Angriffsmuster (je Boss eigenes), dichter/schneller mit der Welle.
  _bossAttack(e, p, nx, nz, attack) {
    const diff = (e.bossWave || 5) / 5; // 1 (Welle 5) .. 5 (Welle 25)
    const ph = e.phaseLevel || 1;       // 1..3 (Enrage); mehr/dichtere Bullets
    const pb = ph - 1;                  // Phasen-Bonus 0..2
    const base = Math.atan2(nx, nz);
    const g = e.def.glow;
    const shoot = (a, opt = {}) =>
      attack.shoot(p.x, p.z, Math.sin(a), Math.cos(a), { color: g, speed: 24, damage: 10, size: 1.3, ...opt });
    let A = e.def.attack || "fan";
    if (A === "combo") { e._flip = !e._flip; A = e._flip ? "fan" : "radial"; } // Finale wechselt
    // Ab Phase 3 hängt jeder Boss einen rotierenden Ring an (Bullet-Hell-Feeling).
    if (ph >= 3) {
      const n = 12;
      const off = e._t * 1.2;
      for (let k = 0; k < n; k++) shoot(off + (k / n) * Math.PI * 2, { speed: 16, size: 0.9 });
    }

    if (A === "fan") {
      const n = 1 + Math.ceil(diff) + pb;     // breiter in höheren Phasen
      for (let k = -n; k <= n; k++) shoot(base + k * 0.18, { speed: 24 + diff * 2 });
    } else if (A === "aimed") {
      const n = 2 + Math.floor(diff / 1.5) + pb;
      for (let k = 0; k < n; k++) shoot(base + (Math.random() - 0.5) * 0.12, { speed: 30 + diff * 3, size: 1.1 });
    } else if (A === "radial") {
      const n = 8 + Math.round(diff * 3) + pb * 4; // dichterer Ring
      const off = e._t * 0.6;                 // dreht sich
      for (let k = 0; k < n; k++) shoot(off + (k / n) * Math.PI * 2, { speed: 18 + diff * 2 });
    } else if (A === "spiral") {
      const arms = 2 + Math.floor(diff / 2) + pb; // mehr Arme
      const a0 = e._t * (3 + diff * 0.6);
      for (let k = 0; k < arms; k++) shoot(a0 + (k / arms) * Math.PI * 2, { speed: 28, size: 1.0 });
    }
  }

  damage(enemy, amount) {
    enemy.hp -= amount;
    enemy.flash = 1; // Treffer-Punch auslösen
    return enemy.hp <= 0;
  }

  kill(enemy) {
    enemy.alive = false;
    this.group.remove(enemy.mesh);
    this.group.remove(enemy.label);
    disposeMesh(enemy.mesh);
  }

  cull() {
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  aliveCount() {
    return this.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  }

  reset() {
    for (const e of this.enemies) {
      this.group.remove(e.mesh);
      this.group.remove(e.label);
      disposeMesh(e.mesh);
    }
    this.enemies = [];
    for (const h of this.hazards) this.group.remove(h.mesh);
    this.hazards = [];
  }

  // Error-Label-Sprite (Material je Typ gecacht).
  _makeLabel(typeKey, def) {
    if (!this._labelMats[typeKey]) {
      this._labelMats[typeKey] = makeLabelMaterial(def.label, def.color);
    }
    const spr = new THREE.Sprite(this._labelMats[typeKey]);
    const w = def.isBoss ? 7 : 3;
    spr.scale.set(w, w * 0.26, 1);
    return spr;
  }

  // --- Mesh-Bau ------------------------------------------------------------
  _buildMesh(typeKey, def) {
    const model = this.models[typeKey];
    if (model) return this._cloneModel(model, def);
    return this._buildProcedural(typeKey, def);
  }

  // Geklontes AI-Modell auf Zielgröße normalisieren und auf Ursprung zentrieren.
  _cloneModel(model, def) {
    const clone = model.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const targetH = def.radius * 2.85; // größere, chunkigere Gegner/Bosse
    const scale = targetH / (size.y || 1);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    const g = new THREE.Group();
    g.add(clone);
    return g;
  }

  // Prozeduraler Fallback-Bug (falls kein AI-Modell geladen ist).
  _buildProcedural(typeKey, def) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: def.color, emissive: def.glow, emissiveIntensity: 0.35,
      metalness: 0.1, roughness: 0.5,
      transparent: !!def.flickers, opacity: def.flickers ? 0.92 : 1,
    });

    let body;
    switch (typeKey) {
      case "stackoverflow": {
        body = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 1.1), mat);
          box.position.y = i * 0.5 - 0.3;
          box.rotation.y = i * 0.3;
          body.add(box);
        }
        break;
      }
      case "racecondition": {
        body = new THREE.Group();
        const a = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), mat);
        a.position.x = -0.28;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), mat);
        b.position.x = 0.28;
        body.add(a, b);
        break;
      }
      case "memoryleak": {
        body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 12), mat);
        body.scale.y = 0.85;
        break;
      }
      case "heisenbug": {
        body = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat);
        break;
      }
      default: {
        body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), mat);
      }
    }
    g.add(body);

    for (const sx of [-0.28, 0.28]) {
      const eye = new THREE.Mesh(this._sharedEye, this._eyeMat);
      eye.position.set(sx, 0.32, 0.55);
      g.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), this._pupilMat);
      pupil.position.set(sx, 0.32, 0.69);
      g.add(pupil);
    }
    for (const sx of [-0.18, 0.18]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), mat);
      ant.position.set(sx, 0.7, 0.15);
      ant.rotation.z = sx * 0.6;
      g.add(ant);
    }

    g.scale.setScalar(def.scale * 1.2); // prozedurale Bosse ~20% größer
    return g;
  }
}

function disposeMesh(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose?.();
    if (o.material) { // geklonte Per-Instanz-Materialien (Treffer-Blitz) mit aufräumen
      const arr = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of arr) m.dispose?.();
    }
  });
}

// Weißer Treffer-Blitz: lerpt die geklonten Materialien Richtung Weiß (f=1) und
// wieder auf ihre Basis zurück (f=0). Emissive bevorzugt, sonst Vertex-Farbe.
const _FLASH_WHITE = new THREE.Color(0xffffff);
function applyFlash(mats, f) {
  if (!mats) return;
  for (const m of mats) {
    if (m.em) {
      m.mat.emissive.copy(m.em).lerp(_FLASH_WHITE, Math.min(1, f * 0.85));
      m.mat.emissiveIntensity = m.ei + f * 1.7;
    } else if (m.col) {
      m.mat.color.copy(m.col).lerp(_FLASH_WHITE, Math.min(1, f * 0.8));
    }
  }
}

// Error-Label als Canvas-Sprite (z.B. "SyntaxError").
function makeLabelMaterial(text, colorHex) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  const col = "#" + colorHex.toString(16).padStart(6, "0");
  ctx.font = "bold 30px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, 128, 34);
  ctx.fillStyle = col;
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
}

// Spawn-Position am Arena-Rand (Arena-Größe wächst pro Welle).
export function edgeSpawn(half = CONFIG.arena.half) {
  half -= 1;
  const side = Math.floor(Math.random() * 4);
  const t = (Math.random() * 2 - 1) * half;
  switch (side) {
    case 0: return { x: t, z: -half };
    case 1: return { x: t, z: half };
    case 2: return { x: -half, z: t };
    default: return { x: half, z: t };
  }
}
