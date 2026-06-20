// Stationen auf der Map: begehbare Felder mit Effekten (Energie, Reparatur).
// Mehr Stationen je größerer Map.
import * as THREE from "three";

export class Stations {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.list = [];
    this._t = 0;
    this._build();
  }

  _build() {
    this._add("recharge", -15, -15, 0xffb02e); // Energie
    this._add("repair", 15, 15, 0x80ed99); // Heilung
    this._add("recharge", 16, -14, 0xffb02e);
    this._add("repair", -16, 14, 0x80ed99);
  }

  _add(kind, x, z, color) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 0.25, 28),
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.85,
      })
    );
    pad.position.set(x, 0.12, z);
    this.group.add(pad);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.14, 8, 32),
      new THREE.MeshBasicMaterial({ color })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.4, z);
    this.group.add(ring);

    // Schwebendes Symbol (Sprite) über der Station.
    const spr = new THREE.Sprite(makeIconMaterial(kind === "recharge" ? "⚡" : "🔧"));
    spr.scale.set(2.2, 2.2, 1);
    spr.position.set(x, 3, z);
    this.group.add(spr);

    this.list.push({ kind, x, z, r: 2.8, pad, ring, spr });
  }

  update(dt) {
    this._t += dt;
    for (const s of this.list) {
      s.ring.rotation.z += dt * 1.5;
      s.pad.position.y = 0.12 + Math.sin(this._t * 2 + s.x) * 0.05;
      s.spr.position.y = 3 + Math.sin(this._t * 2 + s.z) * 0.2;
    }
  }

  // Art der Station, auf der die Position steht (sonst null).
  activeAt(pos) {
    for (const s of this.list) {
      if (Math.hypot(pos.x - s.x, pos.z - s.z) <= s.r) return s.kind;
    }
    return null;
  }
}

function makeIconMaterial(emoji) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.font = "96px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
}
