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
    this.ramps = []; // {minX,maxX,minZ,maxZ, yLow,yHigh, axis,dir}
    this.walls = []; // {minX,maxX,minZ,maxZ}               (Kollisions-AABBs)
    this.rooms = {}; // name -> {minX,maxX,minZ,maxZ, y}

    this._build();
  }

  // ----------------------------------------------------------------- Layout --
  _build() {
    // Raum-Rechtecke (x: links..rechts, z: vorne(+)..hinten(-)).
    const A = this.rooms.arena = { minX: -22, maxX: 22, minZ: -22, maxZ: 22, y: 0 };
    const SHOP = this.rooms.shop = { minX: -13, maxX: 13, minZ: -46, maxZ: -24, y: 0 };
    const PUZZLE = this.rooms.puzzle = { minX: 24, maxX: 50, minZ: -13, maxZ: 13, y: 0 };
    const LOUNGE = this.rooms.lounge = { minX: -50, maxX: -24, minZ: -13, maxZ: 13, y: 0 };
    const HALL = this.rooms.hall = { minX: -9, maxX: 9, minZ: 24, maxZ: 40, y: 0 };
    const VAULT = this.rooms.vault = { minX: -14, maxX: 14, minZ: 40, maxZ: 66, y: 7 };

    // --- Böden je Raum (eigene Optik) ---
    this._floor(A, 0x12151d, true); // Arena: Code-Grid
    this._floor(SHOP, 0x1a1410, false); // Shop: warmes Holz-Braun
    this._floor(PUZZLE, 0x101a18, false); // Rätsel: kühles Cyan-Grün
    this._floor(LOUNGE, 0x16101c, false); // Lounge: Violett
    this._floor(HALL, 0x14171f, false);
    this._floor(VAULT, 0x1d1a10, false); // Vault: golden

    // Korridore zwischen den Räumen (kurze Verbinder durch die Wände).
    this._connector(-4, 4, -24, -22, 0); // Arena -> Shop (Norden)
    this._connector(22, 24, -4, 4, 0); // Arena -> Puzzle (Osten)
    this._connector(-24, -22, -4, 4, 0); // Arena -> Lounge (Westen)
    this._connector(-4, 4, 22, 24, 0); // Arena -> Hall (Süden)

    // --- Treppe: Rampe in der Halle steigt von y0 auf y7 ---
    this.ramps.push({
      minX: -9, maxX: 9, minZ: 24, maxZ: 40, yLow: 0, yHigh: 7, axis: "z", dir: 1,
    });
    this._rampMesh(-9, 9, 24, 40, 0, 7);

    // --- Wände mit Türöffnungen ---
    this._roomWalls(A, [
      { side: "north", from: -4, to: 4 }, // Tür zum Shop
      { side: "south", from: -4, to: 4 }, // Tür zur Halle/Treppe
      { side: "east", from: -4, to: 4 }, // Tür zum Rätselraum
      { side: "west", from: -4, to: 4 }, // Tür zur Lounge
    ]);
    this._roomWalls(SHOP, [{ side: "south", from: -4, to: 4 }]);
    this._roomWalls(PUZZLE, [{ side: "west", from: -4, to: 4 }]);
    this._roomWalls(LOUNGE, [{ side: "east", from: -4, to: 4 }]);
    // Halle: nur Seitenwände (Nord offen zur Arena-Tür, Süd offen zur Treppe).
    this._sideWall(HALL, "east", []);
    this._sideWall(HALL, "west", []);
    // Vault oben: niedrige Brüstung ringsum, offen nach Norden (Rampen-Ankunft).
    this._roomWalls(VAULT, [{ side: "north", from: -9, to: 9 }], 1.1);

    // Sammel-Bodenplatte ganz unten als optischer Untergrund (dunkel, groß).
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 200),
      new THREE.MeshStandardMaterial({ color: 0x06070b, roughness: 0.95, metalness: 0.1 })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(0, -0.05, 0);
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
        const y = r.yLow + (r.yHigh - r.yLow) * t;
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
