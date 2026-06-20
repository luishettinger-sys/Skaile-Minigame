// Bug-Monster: prozedurale Low-Poly-Gegner mit Verhalten pro Typ.
// (Dient als Fallback & Sofort-Spielbarkeit, bevor AI-Modelle reinkommen.)
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { distXZ } from "./utils.js";

export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.enemies = [];
    this._sharedEye = new THREE.SphereGeometry(0.16, 8, 8);
    this._eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4,
    });
    this._pupilMat = new THREE.MeshBasicMaterial({ color: 0x10131a });
  }

  spawn(typeKey, x, z) {
    const def = CONFIG.enemies[typeKey];
    const mesh = this._buildMesh(typeKey, def);
    mesh.position.set(x, def.radius, z);
    this.group.add(mesh);

    const enemy = {
      type: typeKey,
      def,
      mesh,
      hp: def.hp,
      maxHp: def.hp,
      radius: def.radius,
      alive: true,
      phase: Math.random() * Math.PI * 2, // für Bob-/Lauf-Animation
      visible: true, // für Heisenbug-Flacker
    };
    this.enemies.push(enemy);
    return enemy;
  }

  // Bewegung Richtung Ziel + Animation. revealHidden = Ultimate aktiv.
  update(dt, targetPos, revealHidden = false) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const p = e.mesh.position;

      // Richtung zum Ziel (XZ).
      const dx = targetPos.x - p.x;
      const dz = targetPos.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const step = e.def.speed * dt;
      p.x += (dx / len) * step;
      p.z += (dz / len) * step;

      // In Laufrichtung schauen.
      e.mesh.rotation.y = Math.atan2(dx, dz);

      // Lauf-Bob.
      e.phase += dt * (6 + e.def.speed);
      p.y = e.def.radius + Math.abs(Math.sin(e.phase)) * 0.25;

      // Heisenbug flackert unsichtbar – außer im "Rubber Duck Moment".
      if (e.def.flickers) {
        const vis = revealHidden || Math.sin(e.phase * 0.8) > -0.3;
        if (vis !== e.visible) {
          e.visible = vis;
          e.mesh.visible = vis;
        }
      }
    }
  }

  // Schaden zufügen. Gibt true zurück, wenn der Bug stirbt.
  damage(enemy, amount) {
    enemy.hp -= amount;
    // kurzer weißer Trefferblitz
    enemy.mesh.traverse((o) => {
      if (o.material && o.material.emissive) {
        o.material.emissiveIntensity = 1.4;
      }
    });
    return enemy.hp <= 0;
  }

  kill(enemy) {
    enemy.alive = false;
    this.group.remove(enemy.mesh);
    disposeMesh(enemy.mesh);
  }

  // Tote Gegner aus der Liste entfernen (nach Death-Handling im Game-Loop).
  cull() {
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  aliveCount() {
    return this.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  }

  reset() {
    for (const e of this.enemies) {
      this.group.remove(e.mesh);
      disposeMesh(e.mesh);
    }
    this.enemies = [];
  }

  // --- Mesh-Bau ------------------------------------------------------------
  _buildMesh(typeKey, def) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.glow,
      emissiveIntensity: 0.35,
      metalness: 0.1,
      roughness: 0.5,
      transparent: !!def.flickers,
      opacity: def.flickers ? 0.92 : 1,
    });

    let body;
    switch (typeKey) {
      case "stackoverflow": {
        // Gestapelte Boxen – wortwörtlich ein Stack.
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
        // Zwei verschmolzene Kugeln – ein Wettlauf zweier Threads.
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
        // Syntax Error – stacheliger Klumpen.
        body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), mat);
      }
    }
    g.add(body);

    // Augen (zwei, leicht nach vorn).
    for (const sx of [-0.28, 0.28]) {
      const eye = new THREE.Mesh(this._sharedEye, this._eyeMat);
      eye.position.set(sx, 0.32, 0.55);
      g.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), this._pupilMat);
      pupil.position.set(sx, 0.32, 0.69);
      g.add(pupil);
    }

    // Zwei Fühler.
    for (const sx of [-0.18, 0.18]) {
      const ant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5),
        mat
      );
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

// Liefert Spawn-Position am Arena-Rand (Gegner kommen "von außen rein").
export function edgeSpawn() {
  const half = CONFIG.arena.half - 1;
  const side = Math.floor(Math.random() * 4);
  const t = (Math.random() * 2 - 1) * half;
  switch (side) {
    case 0: return { x: t, z: -half };
    case 1: return { x: t, z: half };
    case 2: return { x: -half, z: t };
    default: return { x: half, z: t };
  }
}
