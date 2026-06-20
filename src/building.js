// Das Gebäude: mehrere verbundene Räume auf zwei Etagen, Wände mit Türöffnungen,
// eine Treppe (Rampe) ins Obergeschoss und ein hochwertiger Boden je Raum.
//
// Liefert (ersetzt die alte Terrain-Klasse):
//   heightAt(x,z)            -> begehbare Bodenhöhe (Räume + Rampe)
//   resolveMove(x,z,r)       -> Position gegen Wände auflösen (Kreis vs. AABB)
//   rooms                    -> benannte Raum-Rechtecke (für Spawns/Logik)
import * as THREE from "three";
import { CONFIG } from "./config.js";

const WALL_H = 4.2; // niedrig genug, dass die Kamera in die Räume schaut (Puppenhaus)
const WALL_T = 0.7; // Wandstärke
const NEON = 0x6ee7ff;

export class Building {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.slabs = []; // {minX,maxX,minZ,maxZ, y}            (waagerechte Böden)
    this.ramps = []; // {minX,maxX,minZ,maxZ, yMinZ,yMaxZ}  (Rampen entlang z)
    this.walls = []; // {minX,maxX,minZ,maxZ}               (Kollisions-AABBs)
    this.rooms = {}; // name -> {minX,maxX,minZ,maxZ, y}

    this._build();
  }

  // ----------------------------------------------------------------- Layout --
  // Großes, mehrstöckiges Gebäude (Ebenen y0 / y8 / y14), x/z ca. -95..130.
  _build() {
    const D = 5; // halbe Türbreite (Standard)
    const R = this.rooms;

    // === Erdgeschoss (y0) ===
    const ARENA = R.arena = { minX: -28, maxX: 28, minZ: -28, maxZ: 28, y: 0 };
    // Nord-Flügel: Shop -> Labor
    const SHOP = R.shop = { minX: -16, maxX: 16, minZ: -56, maxZ: -32, y: 0 };
    const LAB = R.lab = { minX: -22, maxX: 22, minZ: -86, maxZ: -60, y: 0 };
    // Ost-Flügel: Rätselraum -> Waffenkammer
    const PUZZLE = R.puzzle = { minX: 32, maxX: 60, minZ: -16, maxZ: 16, y: 0 };
    const ARMORY = R.armory = { minX: 64, maxX: 92, minZ: -16, maxZ: 16, y: 0 };
    // West-Flügel: Lounge -> Serverraum
    const LOUNGE = R.lounge = { minX: -60, maxX: -32, minZ: -16, maxZ: 16, y: 0 };
    const SERVER = R.server = { minX: -92, maxX: -64, minZ: -16, maxZ: 16, y: 0 };

    // === 1. Obergeschoss (y8) – über Süd-Rampe erreichbar ===
    const VAULT = R.vault = { minX: -18, maxX: 18, minZ: 50, maxZ: 84, y: 8 };
    // === 2. Obergeschoss (y14) – über zweite Rampe vom Vault ===
    const ROOF = R.roof = { minX: -16, maxX: 16, minZ: 98, maxZ: 124, y: 14 };
    // Nord-Galerie (y6) – über Rampe hinter dem Labor
    const GALLERY = R.gallery = { minX: -20, maxX: 20, minZ: -128, maxZ: -104, y: 6 };

    // --- Böden je Raum (eigene Optik/Themen) ---
    this._floor(ARENA, 0x12151d, true); // Arena: Code-Grid
    this._floor(SHOP, 0x1f1710, false); // Shop: warmes Braun
    this._floor(LAB, 0x101a1c, false); // Labor: Petrol
    this._floor(PUZZLE, 0x0f1a14, false); // Rätsel: Grün
    this._floor(ARMORY, 0x1c1414, false); // Waffenkammer: Rot
    this._floor(LOUNGE, 0x17101c, false); // Lounge: Violett
    this._floor(SERVER, 0x0c1320, false); // Server: Blau
    this._floor(VAULT, 0x1d1a10, false); // Vault: Gold
    this._floor(ROOF, 0x0a1018, false); // Dach: Nacht
    this._floor(GALLERY, 0x141622, false);

    // --- Korridore (Verbinder durch die Türöffnungen) ---
    this._connector(-D, D, -32, -28, 0); // Arena -> Shop
    this._connector(-D, D, -60, -56, 0); // Shop -> Labor
    this._connector(28, 32, -D, D, 0); // Arena -> Puzzle
    this._connector(60, 64, -D, D, 0); // Puzzle -> Armory
    this._connector(-32, -28, -D, D, 0); // Arena -> Lounge
    this._connector(-64, -60, -D, D, 0); // Lounge -> Server
    this._connector(-D, D, 28, 34, 0); // Arena -> Süd-Rampe

    // --- Rampen (Etagenwechsel) ---
    // Süd: y0 -> y8 (z 34..50) hoch zum Vault.
    this._ramp(-9, 9, 34, 50, 0, 8);
    // Vault -> Dach: y8 -> y14 (z 84..98).
    this._ramp(-9, 9, 84, 98, 8, 14);
    // Nord: hinter dem Labor y0 -> y6 (z -104..-86, steigt Richtung -z).
    this._ramp(-9, 9, -104, -86, 6, 0);

    // --- Wände + Türöffnungen ---
    this._roomWalls(ARENA, [
      { side: "north", from: -D, to: D }, // -> Shop
      { side: "south", from: -D, to: D }, // -> Süd-Rampe
      { side: "east", from: -D, to: D }, // -> Puzzle
      { side: "west", from: -D, to: D }, // -> Lounge
    ]);
    this._roomWalls(SHOP, [{ side: "south", from: -D, to: D }, { side: "north", from: -D, to: D }]);
    this._roomWalls(LAB, [{ side: "south", from: -D, to: D }, { side: "north", from: -9, to: 9 }]);
    this._roomWalls(PUZZLE, [{ side: "west", from: -D, to: D }, { side: "east", from: -D, to: D }]);
    this._roomWalls(ARMORY, [{ side: "west", from: -D, to: D }]);
    this._roomWalls(LOUNGE, [{ side: "east", from: -D, to: D }, { side: "west", from: -D, to: D }]);
    this._roomWalls(SERVER, [{ side: "east", from: -D, to: D }]);
    this._roomWalls(VAULT, [{ side: "north", from: -9, to: 9 }, { side: "south", from: -9, to: 9 }], 1.2);
    this._roomWalls(ROOF, [{ side: "north", from: -9, to: 9 }], 1.2);
    this._roomWalls(GALLERY, [{ side: "south", from: -9, to: 9 }], 1.2);

    // Sammel-Bodenplatte ganz unten als optischer Untergrund (dunkel, groß).
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 360),
      new THREE.MeshStandardMaterial({ color: 0x06070b, roughness: 0.95, metalness: 0.1 })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(0, -0.06, 0);
    base.receiveShadow = true;
    this.group.add(base);
  }

  // ------------------------------------------------------------- Bau-Helfer --
  _floor(r, color, grid) {
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
    const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.4, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.22 })
    );
    slab.position.set(cx, r.y - 0.2, cz);
    slab.receiveShadow = true;
    this.group.add(slab);

    // Leuchtende Bodenkante als Raumumrandung.
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.08, d + 0.2),
      new THREE.MeshBasicMaterial({ color: NEON })
    );
    edge.position.set(cx, r.y + 0.04, cz);
    edge.renderOrder = -1;
    // Nur als dünner Rahmen sichtbar: über dem Slab, leicht transparent.
    edge.material.transparent = true;
    edge.material.opacity = 0.12;
    this.group.add(edge);

    if (grid) {
      const g = new THREE.GridHelper(Math.max(w, d), CONFIG.arena.grid, CONFIG.colors.gridMain, CONFIG.colors.gridSub);
      g.position.set(cx, r.y + 0.02, cz);
      g.material.transparent = true;
      g.material.opacity = 0.5;
      this.group.add(g);
    }

    this.slabs.push({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, y: r.y });
  }

  _connector(minX, maxX, minZ, maxZ, y) {
    const w = maxX - minX, d = maxZ - minZ;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.4, d),
      new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.8, metalness: 0.2 })
    );
    slab.position.set(cx, y - 0.2, cz);
    slab.receiveShadow = true;
    this.group.add(slab);
    this.slabs.push({ minX, maxX, minZ, maxZ, y });
  }

  // Rampe entlang z: Höhe yMinZ (bei minZ) bis yMaxZ (bei maxZ). Registriert
  // sie für heightAt und baut Mesh + Stufen-Optik.
  _ramp(minX, maxX, minZ, maxZ, yMinZ, yMaxZ) {
    this.ramps.push({ minX, maxX, minZ, maxZ, yMinZ, yMaxZ });
    this._rampMesh(minX, maxX, minZ, maxZ, yMinZ, yMaxZ);
  }

  _rampMesh(minX, maxX, zLow, zHigh, yLow, yHigh) {
    const w = maxX - minX, len = zHigh - zLow;
    const cx = (minX + maxX) / 2, cz = (zLow + zHigh) / 2;
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.4, Math.hypot(len, yHigh - yLow)),
      new THREE.MeshStandardMaterial({ color: 0x1b2233, roughness: 0.75, metalness: 0.25 })
    );
    const angle = Math.atan2(yHigh - yLow, len);
    ramp.rotation.x = -angle; // steigt mit +z an
    ramp.position.set(cx, (yLow + yHigh) / 2, cz);
    ramp.receiveShadow = true;
    ramp.castShadow = true;
    this.group.add(ramp);

    // Stufen-Optik + leuchtende Seitenkanten als Treppen-Andeutung.
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const z = zLow + len * t;
      const y = yLow + (yHigh - yLow) * t;
      const lip = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.2, 0.08, 0.5),
        new THREE.MeshBasicMaterial({ color: NEON })
      );
      lip.position.set(cx, y + 0.22, z);
      lip.material.transparent = true;
      lip.material.opacity = 0.6;
      this.group.add(lip);
    }
  }

  // Vier Wände eines Raums mit optionalen Türöffnungen.
  _roomWalls(r, doors = [], height = WALL_H) {
    for (const side of ["north", "south", "east", "west"]) {
      const sideDoors = doors.filter((d) => d.side === side).map((d) => [d.from, d.to]);
      this._sideWall(r, side, sideDoors, height);
    }
  }

  _sideWall(r, side, doors = [], height = WALL_H) {
    const t = WALL_T;
    let fixed, range, horizontal;
    if (side === "north") { fixed = r.minZ; range = [r.minX, r.maxX]; horizontal = true; }
    else if (side === "south") { fixed = r.maxZ; range = [r.minX, r.maxX]; horizontal = true; }
    else if (side === "west") { fixed = r.minX; range = [r.minZ, r.maxZ]; horizontal = false; }
    else { fixed = r.maxX; range = [r.minZ, r.maxZ]; horizontal = false; }

    // Komplement der Türlücken über das Intervall bilden.
    const segs = complement(range[0], range[1], doors);
    for (const [a, b] of segs) {
      if (b - a < 0.05) continue;
      let box;
      if (horizontal) box = { minX: a, maxX: b, minZ: fixed - t / 2, maxZ: fixed + t / 2 };
      else box = { minX: fixed - t / 2, maxX: fixed + t / 2, minZ: a, maxZ: b };
      this._wallMesh(box, r.y, height);
      this.walls.push(box);
    }
  }

  _wallMesh(box, y, height) {
    const w = box.maxX - box.minX, d = box.maxZ - box.minZ;
    const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w, height, d),
      new THREE.MeshStandardMaterial({ color: 0x0e1118, roughness: 0.85, metalness: 0.15 })
    );
    wall.position.set(cx, y + height / 2, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.group.add(wall);

    // Leuchtende Oberkante (Neon-Trim).
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.06, 0.14, d + 0.06),
      new THREE.MeshBasicMaterial({ color: NEON })
    );
    trim.position.set(cx, y + height, cz);
    this.group.add(trim);
  }

  // ------------------------------------------------------------- Abfragen ----
  // Höchste begehbare Fläche unter (x,z): Slabs + Rampen.
  heightAt(x, z) {
    let h = 0, found = false;
    for (const s of this.slabs) {
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
        if (!found || s.y > h) { h = s.y; found = true; }
      }
    }
    for (const r of this.ramps) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const t = (z - r.minZ) / (r.maxZ - r.minZ);
        const y = r.yMinZ + (r.yMaxZ - r.yMinZ) * t;
        if (!found || y > h) { h = y; found = true; }
      }
    }
    return h;
  }

  // Kreis (Radius rr) gegen alle Wände auflösen → erlaubte (x,z)-Position.
  resolveMove(x, z, rr) {
    for (const w of this.walls) {
      // nächster Punkt der AABB zum Kreismittelpunkt
      const nx = Math.max(w.minX, Math.min(x, w.maxX));
      const nz = Math.max(w.minZ, Math.min(z, w.maxZ));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * rr;
          z = nz + (dz / d) * rr;
        } else {
          // Mittelpunkt innerhalb der Wand → auf nächste Kante schieben.
          const left = x - w.minX, right = w.maxX - x;
          const up = z - w.minZ, down = w.maxZ - z;
          const m = Math.min(left, right, up, down);
          if (m === left) x = w.minX - rr;
          else if (m === right) x = w.maxX + rr;
          else if (m === up) z = w.minZ - rr;
          else z = w.maxZ + rr;
        }
      }
    }
    return { x, z };
  }

  // Begrenzt eine Position auf das Innere eines Raums (für Gegner-Roaming).
  clampToRoom(name, x, z, pad = 1) {
    const r = this.rooms[name];
    if (!r) return { x, z };
    return {
      x: Math.max(r.minX + pad, Math.min(x, r.maxX - pad)),
      z: Math.max(r.minZ + pad, Math.min(z, r.maxZ - pad)),
    };
  }
}

// Komplement der gegebenen Lücken [from,to] im Intervall [a,b] → Liste von Segmenten.
function complement(a, b, gaps) {
  const sorted = [...gaps].sort((p, q) => p[0] - q[0]);
  const out = [];
  let cur = a;
  for (const [from, to] of sorted) {
    const f = Math.max(a, from), t = Math.min(b, to);
    if (f > cur) out.push([cur, f]);
    cur = Math.max(cur, t);
  }
  if (cur < b) out.push([cur, b]);
  return out;
}
