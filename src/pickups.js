// Pickups: XP-Gems und Health-Drops mit Pop-in, Bogen-Wurf, Pulsieren
// und Magnet-Anziehung zum Spieler.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { distXZ } from "./utils.js";
import { POWERUPS } from "./powerups.js";

export class PickupSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];

    // XP-Gem: heller Kristall-Kern + additiver Glüh-Halo + Boden-Glühen → hebt
    // sich klar vom Boden ab und ist satisfying. (Glühen gefakt per Sprite, da
    // kein Bloom mehr.)
    this.gemGeo = new THREE.OctahedronGeometry(0.32, 0);
    this.gemMat = new THREE.MeshBasicMaterial({ color: 0xcaf7ff }); // fast weiß-cyan, leuchtend
    this._glowTex = makeGlowTexture();
    this.gemHaloMat = new THREE.SpriteMaterial({ map: this._glowTex, color: 0x4fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.healGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    this.healMat = new THREE.MeshBasicMaterial({ color: 0x80ed99 });
    this.lootGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    this.lootMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    this.coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16);
    this.coinMat = new THREE.MeshBasicMaterial({ color: 0xffcf3f });
    this.luckyGeo = new THREE.BoxGeometry(0.75, 0.75, 0.75);
    this.luckyMat = new THREE.MeshBasicMaterial({ color: 0xff6ec7 });
    this.powerGeo = new THREE.IcosahedronGeometry(0.5, 0);
  }

  spawnPower(x, z, type) {
    this._spawn("power", x, z, type);
  }

  spawnLoot(x, z, item) {
    this._spawn("loot", x, z, item);
  }

  spawnCoins(x, z, amount) {
    this._spawn("coin", x, z, amount);
  }

  spawnLucky(x, z) {
    this._spawn("lucky", x, z, 0);
  }

  spawnGem(x, z, value = CONFIG.pickups.gemValue) {
    this._spawn("gem", x, z, value);
  }

  spawnHealth(x, z) {
    this._spawn("health", x, z, CONFIG.pickups.healAmount);
  }

  _spawn(kind, x, z, value) {
    let mesh;
    if (kind === "gem") {
      // Gruppe: leuchtender Kristall-Kern + additiver Glüh-Halo (Sprite, zur Kamera).
      mesh = new THREE.Group();
      const core = new THREE.Mesh(this.gemGeo, this.gemMat);
      const halo = new THREE.Sprite(this.gemHaloMat);
      halo.scale.set(1.8, 1.8, 1);
      mesh.add(halo, core);
      mesh.userData.core = core;
    }
    else if (kind === "loot") mesh = new THREE.Mesh(this.lootGeo, this.lootMat);
    else if (kind === "coin") mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
    else if (kind === "lucky") mesh = new THREE.Mesh(this.luckyGeo, this.luckyMat);
    else if (kind === "power") {
      const color = (POWERUPS[value] && POWERUPS[value].color) || 0xffffff;
      mesh = new THREE.Mesh(this.powerGeo, new THREE.MeshBasicMaterial({ color }));
    } else mesh = new THREE.Mesh(this.healGeo, this.healMat);
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

      // Magnet: zum Spieler saugen. Ältere Drops (>3.5s) ziehen von selbst
      // heran, egal wie weit weg → es bleibt nichts liegen (Übersicht).
      const d = distXZ(playerPos, it.mesh.position);
      const autoHome = it.t > 3.5;
      if (d < magnet || autoHome) {
        const pull = autoHome ? 10 : 8 + (magnet - d) * 1.6;
        const k = Math.min(1, dt * pull);
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

// Weicher radialer Glüh-Sprite (weiß → transparent) für additive Halos.
function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.55, "rgba(255,255,255,0.3)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
