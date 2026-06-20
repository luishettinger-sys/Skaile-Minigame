// Waffenshop ("Armory"): präsentiert Waffen auf leuchtenden Podesten im
// Ost-Raum. Nah herangehen + [E] kauft & rüstet die Waffe aus (Run-Coins).
import * as THREE from "three";
import { WEAPONS, WEAPON_PRICE } from "./weapons.js";

// Welche Waffen ausgestellt werden (Basis-Blaster bleibt gratis am Start).
const DISPLAY = [
  "smg", "shotgun", "minigun", "trishot",
  "sniper", "railgun", "cannon", "flak",
  "pulse", "sawblade", "arc", "glitch",
  "recursion", "nova", "voidlober", "photon",
];

export class Armory {
  constructor(scene, room) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pads = [];
    this._t = 0;
    this._build(room || { minX: 64, maxX: 92, minZ: -16, maxZ: 16, y: 0 });
  }

  _build(r) {
    const cols = [r.minX + (r.maxX - r.minX) * 0.32, r.minX + (r.maxX - r.minX) * 0.68];
    const rows = 4;
    let idx = 0;
    for (let c = 0; c < cols.length; c++) {
      for (let row = 0; row < rows; row++) {
        if (idx >= DISPLAY.length) break;
        const id = DISPLAY[idx++];
        const w = WEAPONS[id];
        if (!w) continue;
        const z = r.minZ + 4 + ((r.maxZ - r.minZ - 8) * row) / (rows - 1);
        this._pedestal(cols[c], r.y, z, id, w);
      }
    }

    // Großes "ARMORY"-Schild an der Rückwand.
    const sign = new THREE.Sprite(makeLabel("🔫 ARMORY", "Waffen kaufen mit [E]", 0x6ee7ff, 0xffffff));
    sign.scale.set(10, 3.2, 1);
    sign.position.set((r.minX + r.maxX) / 2, r.y + 5.4, r.minZ + 0.6);
    this.group.add(sign);
  }

  _pedestal(x, y, z, id, w) {
    const color = w.color;
    const g = new THREE.Group();

    // Sockel.
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 1.0, 20),
      new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.5, metalness: 0.6 })
    );
    base.position.y = 0.5;
    base.castShadow = true;
    g.add(base);

    // Leuchtender Ring oben.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.09, 8, 24),
      new THREE.MeshBasicMaterial({ color })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.05;
    g.add(ring);

    // Schwebendes, glühendes Display (repräsentiert das Geschoss).
    const display = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.3 })
    );
    display.position.y = 2.2;
    g.add(display);

    // Lichtsäule.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 2.4, 10, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 2.2;
    g.add(beam);

    // Beschriftung (Icon, Name, Preis).
    const price = WEAPON_PRICE[id] ?? 60;
    const label = new THREE.Sprite(makeLabel(`${w.icon} ${w.name}`, `${price} 🪙`, color, 0xffffff));
    label.scale.set(4.6, 1.5, 1);
    label.position.set(0, 3.5, 0);
    g.add(label);

    g.position.set(x, y, z);
    this.group.add(g);
    this.pads.push({ x, z, y, r: 2.2, id, price, display, ring });
  }

  // Nächstes Podest in Reichweite (oder null).
  nearest(pos, range = 2.4) {
    let best = null, bd = range;
    for (const p of this.pads) {
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  update(dt) {
    this._t += dt;
    for (const p of this.pads) {
      p.display.rotation.y += dt * 1.4;
      p.display.position.y = 2.2 + Math.sin(this._t * 2 + p.z) * 0.18;
      p.ring.rotation.z += dt * 0.8;
    }
  }
}

// Label-Sprite mit zwei Textzeilen (Titel + Untertitel).
function makeLabel(title, sub, accent, fg) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 168;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(10,13,20,0.82)";
  roundRect(ctx, 6, 6, c.width - 12, c.height - 12, 22);
  ctx.fill();
  ctx.strokeStyle = "#" + accent.toString(16).padStart(6, "0");
  ctx.lineWidth = 5;
  roundRect(ctx, 6, 6, c.width - 12, c.height - 12, 22);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#" + fg.toString(16).padStart(6, "0");
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.fillText(title, c.width / 2, 74);
  ctx.fillStyle = "#" + accent.toString(16).padStart(6, "0");
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillText(sub, c.width / 2, 128);
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
