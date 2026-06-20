// Pickups: XP-Gems und Health-Drops mit Magnet-Anziehung zum Spieler.
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
  }

  spawnGem(x, z, value = CONFIG.pickups.gemValue) {
    this._spawn("gem", x, z, value);
  }

  spawnHealth(x, z) {
    this._spawn("health", x, z, CONFIG.pickups.healAmount);
  }

  _spawn(kind, x, z, value) {
    const mesh =
      kind === "gem"
        ? new THREE.Mesh(this.gemGeo, this.gemMat)
        : new THREE.Mesh(this.healGeo, this.healMat);
    mesh.position.set(x, 0.5, z);
    this.group.add(mesh);
    this.items.push({ kind, mesh, value, phase: Math.random() * 6 });
  }

  // onCollect(kind, value) wird beim Einsammeln aufgerufen.
  update(dt, playerPos, magnet, onCollect) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.phase += dt * 4;
      it.mesh.rotation.y += dt * 3;
      it.mesh.position.y = 0.5 + Math.sin(it.phase) * 0.12;

      const d = distXZ(playerPos, it.mesh.position);
      if (d < magnet) {
        // Richtung Spieler saugen (je näher, desto schneller).
        const k = Math.min(1, dt * (7 + (magnet - d) * 1.5));
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
