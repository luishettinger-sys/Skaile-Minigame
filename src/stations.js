// Temporäres Energiefeld: erscheint selten an zufälliger Stelle, blinkt am Ende
// und verschwindet wieder. (Keine Dauer-Pads mehr.)
import * as THREE from "three";
import { CONFIG } from "./config.js";

const S = CONFIG.buildScale || 1; // Gebäude-Skalierung → Stände mitziehen

export class Stations {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.field = null;
    this.timer = 9; // bis zum nächsten Spawn
    this._t = 0;
    this.markers = []; // leuchtende [E]-Boden-Ringe an interagierbaren Stationen
    this.shop = null;
    this._buildShop();
    this.deploy = null;
    this._buildDeploy();
  }

  // Leuchtender Boden-Ring + schwebende [E]-Taste → markiert eine Station klar
  // als „hier interagieren". Pulsiert dezent in update().
  _addMarker(x, z, color = 0x2bd4ff) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.7, 2.25, 44),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.06, z);
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
    );
    disk.rotation.x = -Math.PI / 2;
    disk.position.set(x, 0.05, z);
    const key = new THREE.Sprite(makeKeySprite("E", color));
    key.scale.set(1.25, 1.25, 1);
    key.position.set(x, 1.5, z);
    this.group.add(ring, disk, key);
    const m = { ring, disk, key, _t: Math.random() * 6 };
    this.markers.push(m);
    return m;
  }

  // Deploy-Terminal in der Arena: Hier startest DU eine Bug-Welle ("git push" →
  // CI/CD baut → Bugs kommen rein). Macht die Wellen opt-in statt automatisch.
  _buildDeploy() {
    const x = 9 * S, z = -6 * S;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.5, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x1c2740, roughness: 0.5, metalness: 0.35 })
    );
    base.position.set(x, 0.75, z);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 1.2, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x2bd4ff, emissiveIntensity: 0.9, roughness: 0.4 })
    );
    screen.position.set(x, 2.0, z + 0.55);
    screen.rotation.x = -0.18;
    const sign = new THREE.Sprite(makeIcon("🚀"));
    sign.scale.set(2.6, 2.6, 1);
    sign.position.set(x, 3.6, z);
    this.group.add(base, screen, sign);
    this._addMarker(x, z + 1.6, 0x2bd4ff);
    this.deploy = { x, z, r: 3.4, screen, sign, _t: 0 };
  }

  deployNear(pos) {
    return this.deploy && Math.hypot(pos.x - this.deploy.x, pos.z - this.deploy.z) <= this.deploy.r;
  }

  _buildShop() {
    const x = 19.5, z = -19.5; // ganz in die obere rechte Ecke
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.4, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x243042, roughness: 0.7, metalness: 0.3 })
    );
    counter.position.set(x, 0.7, z);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(3.7, 0.2, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x33455e, roughness: 0.6, metalness: 0.35 })
    );
    top.position.set(x, 1.5, z);
    const sign = new THREE.Sprite(makeIcon("🛍️")); // dezenter (kleiner)
    sign.scale.set(1.8, 1.8, 1);
    sign.position.set(x, 2.9, z);
    const keeper = makeKeeperDuck();
    keeper.position.set(x - 1.0, 0, z + 0.5);
    this.group.add(counter, top, sign, keeper);
    this._addMarker(x, z + 1.6, 0xffd23f); // [E]-Ring vor dem Tresen
    this.shop = { x, z: z + 1.6, r: 3.4, sign, keeper };
    this._buildSkins();
  }

  // Skin-Station (Garderobe) – direkt neben dem Shop in der Ecke. E öffnet die Skins.
  _buildSkins() {
    const x = 19.5, z = -13.5;
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.45, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.6, metalness: 0.3 })
    );
    podium.position.set(x, 0.22, z);
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 2.0, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x4a4470, roughness: 0.5 })
    );
    stand.position.set(x, 1.2, z);
    const sign = new THREE.Sprite(makeIcon("👕"));
    sign.scale.set(1.6, 1.6, 1);
    sign.position.set(x, 2.7, z);
    this.group.add(podium, stand, sign);
    this._addMarker(x, z + 1.4, 0xc792ea);
    this.skins = { x, z: z + 1.4, r: 3.2 };
  }

  skinsNear(pos) {
    return this.skins && Math.hypot(pos.x - this.skins.x, pos.z - this.skins.z) <= this.skins.r;
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
    // [E]-Marker dezent pulsieren lassen (Ring + schwebende Taste).
    for (const m of this.markers) {
      m._t += dt;
      const p = 0.45 + Math.sin(m._t * 2.4) * 0.22;
      m.ring.material.opacity = p;
      m.disk.material.opacity = 0.06 + p * 0.08;
      m.key.position.y = 1.5 + Math.sin(m._t * 2.4) * 0.12;
      m.ring.rotation.z += dt * 0.4;
    }
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

// Schwebende Tastatur-Taste (z.B. „E") als Sprite – signalisiert Interaktion.
function makeKeySprite(label, color = 0x2bd4ff) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const hex = "#" + color.toString(16).padStart(6, "0");
  ctx.fillStyle = "rgba(8,12,20,0.88)";
  roundRect(ctx, 26, 24, 76, 80, 16); ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = hex; ctx.stroke();
  ctx.fillStyle = "#eaf6ff";
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
