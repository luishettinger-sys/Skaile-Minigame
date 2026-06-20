// Pickups: XP-Gems und Health-Drops mit Pop-in, Bogen-Wurf, Pulsieren
// und Magnet-Anziehung zum Spieler.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { distXZ } from "./utils.js";

export class PickupSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];

    this.gemGeo = new THREE.OctahedronGeometry(0.34, 0);
    this.gemMat = new THREE.MeshBasicMaterial({ color: 0x6ee7ff });
    this.healGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    this.healMat = new THREE.MeshBasicMaterial({ color: 0x80ed99 });
    this.lootGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    this.lootMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  }

  spawnLoot(x, z, item) {
    this._spawn("loot", x, z, item);
  }

  spawnGem(x, z, value = CONFIG.pickups.gemValue) {
    this._spawn("gem", x, z, value);
  }

  spawnHealth(x, z) {
    this._spawn("health", x, z, CONFIG.pickups.healAmount);
  }

  _spawn(kind, x, z, value) {
    let mesh;
    if (kind === "gem") mesh = new THREE.Mesh(this.gemGeo, this.gemMat);
    else if (kind === "loot") mesh = new THREE.Mesh(this.lootGeo, this.lootMat);
    else mesh = new THREE.Mesh(this.healGeo, this.healMat);
    mesh.position.set(x, 0.6, z);
    mesh.scale.setScalar(0.01); // Pop-in
    this.group.add(mesh);
    this.items.push({
      kind, mesh, value,
      phase: Math.random() * 6,
      t: 0,
      vy: 6 + Math.random() * 4, // Bogen-Wurf nach oben
    });
  }

  // onCollect(kind, value) wird beim Einsammeln aufgerufen.
  update(dt, playerPos, magnet, onCollect) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      it.phase += dt * 5;
      it.mesh.rotation.y += dt * 4;

      // Pop-in + Pulsieren.
      const grow = Math.min(1, it.t * 6);
      const pulse = 1 + Math.sin(it.phase * 2) * 0.14;
      it.mesh.scale.setScalar(grow * pulse);

      // Bogen: hochspringen, dann auf Ruhehöhe einpendeln.
      it.vy -= 22 * dt;
      let ny = it.mesh.position.y + it.vy * dt;
      const rest = 0.55 + Math.sin(it.phase) * 0.12;
      if (ny <= rest) { ny = rest; it.vy = 0; }
      it.mesh.position.y = ny;

      // Magnet: zum Spieler saugen.
      const d = distXZ(playerPos, it.mesh.position);
      if (d < magnet) {
        const k = Math.min(1, dt * (8 + (magnet - d) * 1.6));
        it.mesh.position.x += (playerPos.x - it.mesh.position.x) * k;
        it.mesh.position.z += (playerPos.z - it.mesh.position.z) * k;
      }
      if (d < CONFIG.pickups.collectRadius) {
        onCollect(it.kind, it.value);
        this.group.remove(it.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  reset() {
    for (const it of this.items) this.group.remove(it.mesh);
    this.items = [];
  }
}
