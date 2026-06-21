// Waffenshop ("Armory"): präsentiert Waffen auf leuchtenden Podesten im
// Ost-Raum. Nah herangehen + [E] kauft & rüstet die Waffe aus (Run-Coins).
//
// Inszenierung: flaches, breites Raster (übersichtlich statt Haufen), pro Tier
// eine farbige Bodenscheibe (Einstieg=Cyan, Mitte=Violett, Spitze=Gold) und ein
// Proximity-Fokus: das Podest, vor dem du stehst, hebt sich, dreht schneller,
// leuchtet auf und zeigt sein Namensschild — die übrigen bleiben ruhig & gedimmt
// (nur ein Label sichtbar statt 27 → keine Reizüberflutung).
import * as THREE from "three";
import { WEAPONS, WEAPON_PRICE } from "./weapons.js";
import { cloneWeaponModel } from "./weaponmodels.js";

// Welche Waffen ausgestellt werden (Basis-Blaster bleibt gratis am Start).
// Die kreativen Spezialwaffen stehen voran, damit sie sofort auffallen.
const DISPLAY = [
  // kreative Spezialwaffen
  "boomerang", "rocket", "grenade", "ricochet", "singularity",
  "tesla", "swarm", "wobble", "flame", "forkbomb",
  // klassisches Arsenal
  "smg", "shotgun", "minigun", "trishot", "needler",
  "sniper", "railgun", "cannon", "flak", "pulse",
  "sawblade", "arc", "glitch", "recursion", "nova",
  "voidlober", "photon",
];

// Tier-Farbe nach Preis → Gruppierung auf einen Blick.
function tierColor(price) {
  if (price <= 95) return 0x6ee7ff;   // Einstieg – Cyan
  if (price <= 150) return 0x9b5de5;  // Mittelklasse – Violett
  return 0xffd23f;                     // Spitze – Gold
}

export class Armory {
  constructor(scene, room) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pads = [];
    this._t = 0;
    this._build(room || { minX: 64, maxX: 92, minZ: -16, maxZ: 16, y: 0 });
  }

  _build(r) {
    // Flaches, breites Raster: viele Spalten, wenige Reihen → man blickt die
    // Waffen nebeneinander an statt in einen tiefen Stapel.
    const n = DISPLAY.length;
    const colCount = 5;
    const rows = Math.ceil(n / colCount);
    const cols = [];
    for (let c = 0; c < colCount; c++) {
      cols.push(r.minX + (r.maxX - r.minX) * (0.1 + 0.8 * (c / (colCount - 1))));
    }
    const z0 = r.minZ + 4, z1 = r.maxZ - 4;
    let idx = 0;
    for (let row = 0; row < rows; row++) {
      for (let c = 0; c < colCount; c++) {
        if (idx >= n) break;
        const id = DISPLAY[idx++];
        const w = WEAPONS[id];
        if (!w) continue;
        const z = rows === 1 ? (z0 + z1) / 2 : z0 + ((z1 - z0) * row) / (rows - 1);
        this._pedestal(cols[c], r.y, z, id, w);
      }
    }

    // Großes "SCHMIEDE"-Schild an der Rückwand.
    const sign = new THREE.Sprite(makeLabel("🔨 SCHMIEDE", "Waffen holen · Mods bauen [E]", 0xffa040, 0xffffff));
    sign.scale.set(11, 3.2, 1);
    sign.position.set((r.minX + r.maxX) / 2, r.y + 5.4, r.minZ + 0.6);
    this.group.add(sign);

    // Schmiede-Amboss im pad-freien Streifen vorn am Raum (Mod-Crafting-Station).
    this._buildForge((r.minX + r.maxX) / 2, r.y, r.minZ + 1.5);
  }

  // Amboss + Glut-Esse: hier baust du aus Schrott permanente Waffen-Mods.
  _buildForge(x, y, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.8, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.8, metalness: 0.4 })
    );
    base.position.y = 0.25;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.4, metalness: 0.85 })
    );
    block.position.y = 0.9;
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 1.0, 10),
      new THREE.MeshStandardMaterial({ color: 0x33333a, roughness: 0.4, metalness: 0.85 })
    );
    horn.rotation.z = Math.PI / 2;
    horn.position.set(0.85, 1.05, 0);
    // Glühende Esse (additives Glimmen).
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xff7820, transparent: true, opacity: 0.85 })
    );
    glow.position.set(-0.2, 1.35, 0);
    const sign = new THREE.Sprite(makeLabel("🔨 MODS", "[E] aus 🔩 bauen", 0xffa040, 0xffffff));
    sign.scale.set(4.4, 1.45, 1);
    sign.position.set(0, 3.0, 0);
    g.add(base, block, horn, glow, sign);
    g.position.set(x, y, z);
    this.group.add(g);
    this.forge = { x, z, r: 3.0, glow, _t: 0 };
  }

  forgeNear(pos, range) {
    if (!this.forge) return false;
    return Math.hypot(pos.x - this.forge.x, pos.z - this.forge.z) <= (range || this.forge.r);
  }

  _pedestal(x, y, z, id, w) {
    const color = w.color;
    const price = WEAPON_PRICE[id] ?? 60;
    const tier = tierColor(price);
    const g = new THREE.Group();

    // Tier-Bodenscheibe (Gruppierung nach Preis).
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 28),
      new THREE.MeshBasicMaterial({ color: tier, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    g.add(disc);

    // Sockel.
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 1.0, 20),
      new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.5, metalness: 0.6 })
    );
    base.position.y = 0.5;
    base.castShadow = true;
    g.add(base);

    // Leuchtender Ring oben (Waffenfarbe = Identität).
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.09, 8, 24),
      new THREE.MeshBasicMaterial({ color })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.05;
    g.add(ring);

    // Fokus-Halo (erscheint nur beim Herantreten).
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.05, 8, 32),
      new THREE.MeshBasicMaterial({ color: tier, transparent: true, opacity: 0, depthWrite: false })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.15;
    g.add(halo);

    // Schwebendes, glühendes Display (Platzhalter bis das Modell geladen ist).
    const display = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.3 })
    );
    display.position.y = 2.2;
    g.add(display);

    // Lichtsäule.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 2.4, 10, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 2.2;
    g.add(beam);

    // Beschriftung (Icon, Name, Preis) – standardmäßig unsichtbar, nur im Fokus.
    const label = new THREE.Sprite(makeLabel(`${w.icon} ${w.name}`, `${price} 🪙`, tier, 0xffffff));
    label.scale.set(4.6, 1.5, 1);
    label.position.set(0, 3.6, 0);
    label.material.opacity = 0;
    label.visible = false;
    g.add(label);

    g.position.set(x, y, z);
    this.group.add(g);
    this.pads.push({ x, z, y, r: 2.2, id, price, display, ring, beam, halo, disc, label, foc: 0 });
  }

  // Echte GLB-Waffenmodelle auf die Podeste setzen (sobald geladen).
  populateModels() {
    for (const p of this.pads) {
      if (p.model) continue;
      const m = cloneWeaponModel(p.id);
      if (!m) continue;
      m.scale.setScalar(1.25); // Basis-Schaugröße (native Proportionen bleiben)
      m.position.set(p.x, p.y + 2.25, p.z);
      this.group.add(m);
      p.model = m;
      p.display.visible = false; // Platzhalter-Kristall ausblenden
    }
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

  // dt + Spielerposition: animiert Idle + Proximity-Fokus.
  update(dt, playerPos) {
    this._t += dt;
    if (this.forge) {
      this.forge.glow.material.opacity = 0.6 + Math.sin(this._t * 3) * 0.25;
      this.forge.glow.scale.setScalar(1 + Math.sin(this._t * 3) * 0.12);
    }

    // Nächstes Podest bestimmen (Fokus).
    let focus = null, fd = 3.4;
    if (playerPos) {
      for (const p of this.pads) {
        const d = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
        if (d < fd) { fd = d; focus = p; }
      }
    }

    for (const p of this.pads) {
      // Fokus-Wert 0..1 sanft annähern.
      const want = p === focus ? 1 : 0;
      p.foc += (want - p.foc) * Math.min(1, dt * 9);
      const f = p.foc;

      const lift = f * 0.55;
      const bob = Math.sin(this._t * 2 + p.z) * (0.16 + f * 0.12);

      // Schwebendes Modell / Platzhalter: drehen, heben, im Fokus vergrößern.
      if (p.model) {
        p.model.rotation.y += dt * (0.7 + f * 2.6);
        p.model.position.y = p.y + 2.25 + lift + bob;
        p.model.scale.setScalar(1.25 * (1 + f * 0.34));
      } else {
        p.display.rotation.y += dt * (1.2 + f * 2.4);
        p.display.position.y = 2.2 + lift + bob;
        p.display.scale.setScalar(1 + f * 0.34);
      }

      p.ring.rotation.z += dt * (0.8 + f * 1.8);

      // Lichtsäule heller im Fokus, dezent pulsierend.
      if (p.beam) p.beam.material.opacity = 0.12 + f * 0.42 + Math.sin(this._t * 4 + p.z) * 0.03 * f;
      // Tier-Scheibe atmet, im Fokus stärker.
      if (p.disc) p.disc.material.opacity = 0.16 + 0.06 * Math.sin(this._t * 2.4 + p.z) + f * 0.3;

      // Fokus-Halo: erscheint, dreht & pulsiert.
      if (p.halo) {
        p.halo.material.opacity = f * 0.8;
        p.halo.rotation.z += dt * 2.2 * f;
        p.halo.scale.setScalar(1 + Math.sin(this._t * 5) * 0.05 * f);
      }

      // Namensschild nur für das fokussierte Podest (räumt den Raum auf).
      if (p.label) {
        p.label.visible = f > 0.04;
        p.label.material.opacity = Math.min(1, f * 1.4);
        const s = 1 + f * 0.12;
        p.label.scale.set(4.6 * s, 1.5 * s, 1);
        p.label.position.y = 3.4 + lift + f * 0.3;
      }
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
