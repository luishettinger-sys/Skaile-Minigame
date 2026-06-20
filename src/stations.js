// Temporäres Energiefeld: erscheint selten an zufälliger Stelle, blinkt am Ende
// und verschwindet wieder. (Keine Dauer-Pads mehr.)
import * as THREE from "three";

export class Stations {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.field = null;
    this.timer = 9; // bis zum nächsten Spawn
    this._t = 0;
  }

  _spawnField(arenaHalf) {
    const x = (Math.random() * 2 - 1) * (arenaHalf - 5);
    const z = (Math.random() * 2 - 1) * (arenaHalf - 5);
    const color = 0xffd23f;
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.2, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
    );
    pad.position.set(x, 0.12, z);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.12, 8, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.35, z);
    const spr = new THREE.Sprite(makeIcon("⚡"));
    spr.scale.set(2, 2, 1);
    spr.position.set(x, 3, z);
    this.group.add(pad, ring, spr);
    this.field = { x, z, r: 2.4, pad, ring, spr, life: 7 };
  }

  _removeField() {
    if (!this.field) return;
    this.group.remove(this.field.pad, this.field.ring, this.field.spr);
    this.field = null;
  }

  update(dt, arenaHalf) {
    this._t += dt;
    if (this.field) {
      this.field.life -= dt;
      this.field.ring.rotation.z += dt * 2;
      // letzte 2 Sekunden: blinken.
      const blink = this.field.life < 2 ? (Math.sin(this._t * 20) > 0 ? 1 : 0.2) : 1;
      this.field.pad.material.opacity = 0.7 * blink;
      this.field.ring.material.opacity = blink;
      this.field.spr.material.opacity = blink;
      this.field.spr.position.y = 3 + Math.sin(this._t * 3) * 0.2;
      if (this.field.life <= 0) this._removeField();
    } else {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 12 + Math.random() * 8;
        this._spawnField(arenaHalf);
      }
    }
  }

  activeAt(pos) {
    if (this.field && Math.hypot(pos.x - this.field.x, pos.z - this.field.z) <= this.field.r) {
      return "recharge";
    }
    return null;
  }

  reset() {
    this._removeField();
    this.timer = 9;
  }
}

function makeIcon(emoji) {
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
