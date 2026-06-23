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
// Kuratierte, übersichtliche Auswahl: 3 Tier-Reihen à 4 Waffen (von schwach → stark).
// Die übrigen Waffen bleiben über den Shop erhältlich – der Raum bleibt aufgeräumt.
const DISPLAY = [
  // Tier 1 – Einstieg (niedriges Level)
  "shotgun", "smg", "trishot", "needler",
  // Tier 2 – Mittelklasse
  "cannon", "minigun", "flak", "flame",
  // Tier 3 – Spitze (hohes Level)
  "railgun", "sniper", "rocket", "photon",
];

// Tier-Farbe nach Preis → Gruppierung auf einen Blick (neue Preis-Schwellen).
function tierColor(price) {
  if (price <= 175) return 0x6ee7ff;   // Einstieg – Cyan
  if (price <= 290) return 0x9b5de5;   // Mittelklasse – Violett
  return 0xffd23f;                       // Spitze – Gold
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
    const cz = (r.minZ + r.maxZ) / 2;
    // Aufgeräumt: EIN Marktstand mit Verkäufer-Ente (statt 27 Podesten). [E] öffnet
    // das scrollbare, nach Stärke sortierte Arsenal.
    this._buildStall(r.minX + 6, r.y, cz);
  }

  // Markt-Verkaufsstand: Theke + Baldachin + Verkäufer-Ente + Preview-Waffen.
  _buildStall(x, y, z) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4524, roughness: 0.85 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.9 });
    // Theke.
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.5, 2.0), wood); counter.position.y = 0.75;
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.2, 2.4), woodDark); top.position.y = 1.55;
    g.add(counter, top);
    // 4 Pfosten + gestreiftes Baldachin-Dach.
    for (const px of [-2.7, 2.7]) for (const pz of [-1.1, 1.1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.0, 0.18), woodDark); post.position.set(px, 2.0, pz); g.add(post);
    }
    for (let i = 0; i < 6; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 3.0),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd23b3b : 0xf2e9d8, roughness: 0.8 }));
      stripe.position.set(-2.5 + i, 4.0, 0); stripe.rotation.x = 0.12; g.add(stripe);
    }
    // Schild.
    const sign = new THREE.Sprite(makeLabel("🛒 WAFFEN-MARKT", "[E] Arsenal öffnen", 0xffd23f, 0xffffff));
    sign.scale.set(6.0, 1.9, 1); sign.position.set(0, 5.2, 0); g.add(sign);
    // Verkäufer-Ente hinter der Theke.
    const duck = makeVendorDuck(); duck.position.set(0, 0, -0.9); g.add(duck);
    // Preview-Waffen auf der Theke (drehen sich).
    this._previews = [];
    const previewIds = ["shotgun", "railgun", "sniper"];
    previewIds.forEach((id, i) => {
      const m = cloneWeaponModel(id);
      if (!m) return;
      m.scale.setScalar(1.1);
      m.position.set(-1.6 + i * 1.6, 1.95, 0.4);
      g.add(m); this._previews.push(m);
    });
    g.position.set(x, y, z);
    g.rotation.y = -Math.PI / 2; // Front (Theke) zur Arena/Eingang (−x)
    this.group.add(g);
    this.stall = { x, z, r: 3.8 };
  }

  // Steht die Ente am Marktstand?
  stallNear(pos, range) {
    if (!this.stall) return false;
    return Math.hypot(pos.x - this.stall.x, pos.z - this.stall.z) <= (range || this.stall.r);
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
    // Preview-Waffen am Stand drehen.
    if (this._previews) for (const m of this._previews) m.rotation.y += dt * 1.2;

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
  const maxW = c.width - 48; // Innenabstand, damit Text nie ans Schild-Rand stößt
  // Schrift so weit verkleinern, dass die Zeile garantiert reinpasst (kein Clipping).
  const fitFont = (text, px) => {
    let size = px;
    do { ctx.font = `bold ${size}px system-ui, sans-serif`; size -= 2; }
    while (size > 14 && ctx.measureText(text).width > maxW);
  };
  ctx.fillStyle = "#" + fg.toString(16).padStart(6, "0");
  fitFont(title, 44);
  ctx.fillText(title, c.width / 2, 74);
  ctx.fillStyle = "#" + accent.toString(16).padStart(6, "0");
  fitFont(sub, 40);
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

// Kleine prozedurale Verkäufer-Ente (Händler hinter der Theke).
function makeVendorDuck() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6 }));
  body.scale.set(1, 0.92, 1.08); body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xffdf5a, roughness: 0.6 }));
  head.position.set(0, 1.85, 0.18);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 10),
    new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.5 }));
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.82, 0.6);
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 14),
    new THREE.MeshStandardMaterial({ color: 0x2b6a3a, roughness: 0.7 }));
  hatBrim.position.set(0, 2.12, 0.18);
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.34, 14),
    new THREE.MeshStandardMaterial({ color: 0x2b6a3a, roughness: 0.7 }));
  hatTop.position.set(0, 2.32, 0.18);
  for (const o of [body, head, beak, hatBrim, hatTop]) { o.castShadow = true; g.add(o); }
  return g;
}
