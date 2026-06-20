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
    this.shop = null;
    this._buildShop();
  }

  _buildShop() {
    const x = 0, z = -50; // im Shop-Raum (Norden), unter dem Build-Monitor
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(5, 1.6, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x6b3f1d, roughness: 0.7 })
    );
    counter.position.set(x, 0.8, z);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 0.25, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.6 })
    );
    top.position.set(x, 1.7, z);
    const sign = new THREE.Sprite(makeIcon("🛒"));
    sign.scale.set(2.8, 2.8, 1);
    sign.position.set(x, 3.7, z);
    const keeper = makeKeeperDuck();
    keeper.position.set(x - 1.2, 0, z + 0.6);
    this.group.add(counter, top, sign, keeper);
    this.shop = { x, z, r: 3.8, sign, keeper };
  }

  shopNear(pos) {
    return this.shop && Math.hypot(pos.x - this.shop.x, pos.z - this.shop.z) <= this.shop.r;
  }

  // Prozedurale Verkäufer-Ente gegen AI-3D-Modell tauschen.
  setKeeperModel(obj) {
    if (!this.shop) return;
    if (this.shop.keeper) this.group.remove(this.shop.keeper);
    obj.position.set(this.shop.x - 1.2, 0, this.shop.z + 0.7);
    this.group.add(obj);
    this.shop.keeper = obj;
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

// Kleiner Soldaten-Enten-Verkäufer (prozedural).
function makeKeeperDuck() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b8e23, roughness: 0.6 })
  );
  body.scale.set(1, 0.9, 1.1);
  body.position.y = 1.0;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x7a9a2e, roughness: 0.6 })
  );
  head.position.set(0, 1.7, 0.2);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.4, 10),
    new THREE.MeshStandardMaterial({ color: 0xff8c1a })
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.66, 0.7);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x4b5320, roughness: 0.7, metalness: 0.2 })
  );
  helmet.position.set(0, 1.9, 0.2);
  g.add(body, head, beak, helmet);
  return g;
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
