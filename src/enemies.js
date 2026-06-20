// Bug-Monster: lädt AI-3D-Modelle pro Typ (geklont je Instanz, geteilte
// Buffers) und fällt auf prozedurale Low-Poly-Gegner zurück, falls kein
// Modell vorhanden ist.
import * as THREE from "three";
import { CONFIG } from "./config.js";

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
    };
    this.enemies.push(enemy);
    return enemy;
  }

  update(dt, targetPos, revealHidden = false) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const p = e.mesh.position;

      // Richtung zum Ziel (XZ).
      const dx = targetPos.x - p.x;
      const dz = targetPos.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const step = e.speed * dt;
      p.x += (dx / len) * step;
      p.z += (dz / len) * step;

      e.mesh.rotation.y = Math.atan2(dx, dz);

      // Lebendige Bewegung: Hüpfen, Wackeln, Stufen-Klettern, Flieger schweben.
      e.phase += dt * (6 + e.speed);
      const gy = this.terrain ? this.terrain.heightAt(p.x, p.z) : 0;
      const bounce = Math.abs(Math.sin(e.phase)) * 0.4;
      const fly = e.def.fly ? 1.5 + Math.sin(e.phase * 0.6) * 0.85 : 0;
      p.y = gy + e.def.radius + bounce + fly;
      e.mesh.rotation.z = Math.sin(e.phase * 0.7) * 0.16; // seitliches Wackeln

      // Treffer-Punch (per Instanz, daher Skalierung statt Material).
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);
      e.mesh.scale.setScalar(e.baseScale * (1 + e.flash * 0.35));

      // Error-Label über dem Bug mitführen.
      e.label.position.set(p.x, p.y + e.def.radius * 2.4 + 0.7, p.z);

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

    const targetH = def.radius * 2.4;
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

    g.scale.setScalar(def.scale);
    return g;
  }
}

function disposeMesh(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose?.();
  });
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
