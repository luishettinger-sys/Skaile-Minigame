// Kaufbare Automatisierungen (Idle-Helfer), präsentiert auf Podesten im Labor:
//   • Drohne   – umkreist die Ente, schießt selbstständig auf Gegner
//   • Reparatur – passive HP-Regeneration
//   • Sammler   – größerer Magnet für Coins/Drops
// Kauf via [E] (Run-Coins). Preise steigen pro Stufe.
import * as THREE from "three";

const ITEMS = {
  drone: { icon: "🤖", name: "Angriffs-Drohne", base: 60, step: 45, max: 6, color: 0x6ee7ff },
  repair: { icon: "🛠️", name: "Auto-Reparatur", base: 50, step: 40, max: 5, color: 0x80ed99 },
  collector: { icon: "🧲", name: "Auto-Sammler", base: 40, step: 30, max: 5, color: 0xffd23f },
};

export class Automation {
  constructor(scene, room) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.levels = { drone: 0, repair: 0, collector: 0 };
    this.drones = [];
    this.pads = [];
    this._t = 0;

    this._buildShop(room || { minX: -22, maxX: 22, minZ: -86, maxZ: -60, y: 0 });
  }

  // --- Kauf-Podeste im Labor -------------------------------------------------
  _buildShop(r) {
    const cx = (r.minX + r.maxX) / 2;
    const ids = Object.keys(ITEMS);
    ids.forEach((id, i) => {
      const x = cx + (i - (ids.length - 1) / 2) * 7;
      const z = r.minZ + 5;
      this._pedestal(x, r.y, z, id);
    });

    const sign = new THREE.Sprite(makeLabel("🤖 AUTOMATION-LAB", "Idle-Helfer kaufen mit [E]", 0x80ed99));
    sign.scale.set(11, 3, 1);
    sign.position.set(cx, r.y + 5.6, r.minZ + 0.8);
    this.group.add(sign);
  }

  _pedestal(x, y, z, id) {
    const def = ITEMS[id];
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 1.0, 18),
      new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.5, metalness: 0.6 })
    );
    base.position.y = 0.5;
    g.add(base);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.09, 8, 22),
      new THREE.MeshBasicMaterial({ color: def.color })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.05;
    g.add(ring);
    const disp = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 1.6, roughness: 0.3 })
    );
    disp.position.y = 2.2;
    g.add(disp);
    const label = new THREE.Sprite(makeLabel(`${def.icon} ${def.name}`, "", def.color));
    label.scale.set(5, 1.4, 1);
    label.position.set(0, 3.4, 0);
    g.add(label);
    g.position.set(x, y, z);
    this.group.add(g);
    this.pads.push({ x, z, id, disp, ring, label });
  }

  priceFor(id) {
    const def = ITEMS[id];
    return def.base + def.step * this.levels[id];
  }
  nameFor(id) { return `${ITEMS[id].icon} ${ITEMS[id].name}`; }
  isMax(id) { return this.levels[id] >= ITEMS[id].max; }
  labelFor(id) {
    const def = ITEMS[id];
    if (this.isMax(id)) return `${def.icon} ${def.name} – MAX`;
    return `[E] ${def.icon} ${def.name} Lv${this.levels[id] + 1} – ${this.priceFor(id)} 🪙`;
  }

  // Kauf anwenden (Coins-Abzug passiert im Game). Gibt true bei Erfolg.
  apply(id) {
    if (this.isMax(id)) return false;
    this.levels[id]++;
    if (id === "drone") this._addDrone();
    return true;
  }

  nearest(pos, range = 2.4) {
    let best = null, bd = range;
    for (const p of this.pads) {
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // --- Drohnen ---------------------------------------------------------------
  _addDrone() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x1a2230, emissive: 0x113344, roughness: 0.4, metalness: 0.5 })
    );
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x6ee7ff, emissive: 0x6ee7ff, emissiveIntensity: 2 })
    );
    eye.position.z = 0.34;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.05, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0x6ee7ff })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(body, eye, ring);
    this.scene.add(g);
    this.drones.push({ g, eye, ang: Math.random() * Math.PI * 2, fireT: Math.random() * 0.6 });
  }

  // center = Spielerposition; nearestFn(range)->enemy|null; fire(origin,dir).
  update(dt, center, nearestFn, fire) {
    this._t += dt;
    for (const p of this.pads) { p.disp.rotation.y += dt * 1.3; p.ring.rotation.z += dt * 0.7; }

    const n = this.drones.length;
    for (let i = 0; i < n; i++) {
      const d = this.drones[i];
      d.ang += dt * 1.3;
      const a = d.ang + (i / Math.max(1, n)) * Math.PI * 2;
      const radius = 3.6;
      const x = center.x + Math.cos(a) * radius;
      const z = center.z + Math.sin(a) * radius;
      const y = (center.y || 0) + 2.4 + Math.sin(this._t * 3 + i) * 0.2;
      d.g.position.set(x, y, z);

      d.fireT -= dt;
      const tgt = nearestFn(34);
      if (tgt) {
        const dx = tgt.mesh.position.x - x, dz = tgt.mesh.position.z - z;
        d.g.rotation.y = Math.atan2(dx, dz);
        if (d.fireT <= 0) {
          d.fireT = 0.7;
          const len = Math.hypot(dx, dz) || 1;
          fire({ x, z }, { x: dx / len, z: dz / len });
        }
      }
    }
  }

  reset() {
    for (const d of this.drones) this.scene.remove(d.g);
    this.drones = [];
    this.levels = { drone: 0, repair: 0, collector: 0 };
  }
}

function makeLabel(title, sub, accent) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = sub ? 168 : 110;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(10,13,20,0.82)";
  rr(ctx, 6, 6, c.width - 12, c.height - 12, 20); ctx.fill();
  ctx.strokeStyle = "#" + accent.toString(16).padStart(6, "0");
  ctx.lineWidth = 5; rr(ctx, 6, 6, c.width - 12, c.height - 12, 20); ctx.stroke();
  ctx.textAlign = "center"; ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px system-ui, sans-serif";
  ctx.fillText(title, c.width / 2, sub ? 70 : 70);
  if (sub) {
    ctx.fillStyle = "#" + accent.toString(16).padStart(6, "0");
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.fillText(sub, c.width / 2, 126);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
