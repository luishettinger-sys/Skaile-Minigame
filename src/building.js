// Das Gebäude: mehrere verbundene Räume auf zwei Etagen, Wände mit Türöffnungen,
// eine Treppe (Rampe) ins Obergeschoss und ein hochwertiger Boden je Raum.
//
// Liefert (ersetzt die alte Terrain-Klasse):
//   heightAt(x,z)            -> begehbare Bodenhöhe (Räume + Rampe)
//   resolveMove(x,z,r)       -> Position gegen Wände auflösen (Kreis vs. AABB)
//   rooms                    -> benannte Raum-Rechtecke (für Spawns/Logik)
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeFloorMaterial, makeCircuitMaterial } from "./floortex.js";

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
    this._scaleBuilding(CONFIG.buildScale || 1);
  }

  // Skaliert das gesamte Gebäude (Mesh-Gruppe + alle Kollisions-/Raum-Daten) um
  // den Faktor S. Ente & Gegner bleiben gleich groß → mehr Raum zum Erkunden.
  _scaleBuilding(S) {
    if (!S || S === 1) return;
    this.group.scale.setScalar(S);
    const sc = (o, keys) => { for (const k of keys) if (k in o && typeof o[k] === "number") o[k] *= S; };
    for (const w of this.walls) sc(w, ["minX", "maxX", "minZ", "maxZ"]);
    for (const s of this.slabs) sc(s, ["minX", "maxX", "minZ", "maxZ", "y"]);
    for (const r of this.ramps) sc(r, ["minX", "maxX", "minZ", "maxZ", "yMinZ", "yMaxZ"]);
    for (const k in this.rooms) sc(this.rooms[k], ["minX", "maxX", "minZ", "maxZ", "y"]);
    // Tür-Hitboxen (wallBox) sind bereits in this.walls enthalten → nur Zentren/Radien.
    for (const d of this.doors || []) { d.cx *= S; d.cz *= S; d.r *= S; }
  }

  // ----------------------------------------------------------------- Layout --
  // Kompakter Hauptraum (Arena) + genau 4 Funktionsräume drumherum:
  //   Nord = Bug-Farm (Coins → Monster/XP), Ost = Waffen, Süd = Skins, West = Power-Ups.
  _build() {
    const D = 5; // halbe Türbreite
    const R = this.rooms;

    const ARENA = R.arena    = { minX: -26, maxX: 26, minZ: -26, maxZ: 26, y: 0 };
    const NORTH = R.spawner  = { minX: -15, maxX: 15, minZ: -52, maxZ: -30, y: 0 }; // oben: Workstation
    const EAST  = R.armory   = { minX: 30,  maxX: 52,  minZ: -15, maxZ: 15,  y: 0 }; // rechts: Waffen
    // Süd (Forschung) & West (Fabrikator) entfernt – waren unklar/verwirrend (Wunsch Luis).

    // Böden (Platinen-Look). Farben = Leitfarbe je Raum.
    this._floor(ARENA, 0x123026, false, "tech");
    this._floor(NORTH, 0x2a1418, false, "tech");
    this._floor(EAST,  0x2e1414, false, "tech");

    // Korridore (Tür-Öffnungen Arena ↔ Räume).
    this._connector(-D, D, -30, -26, 0); // -> Nord
    this._connector(26, 30, -D, D, 0);   // -> Ost

    // Wände + Türöffnungen.
    this._roomWalls(ARENA, [
      { side: "north", from: -D, to: D },
      { side: "east",  from: -D, to: D },
    ]); // Süd- & West-Seite jetzt massiv (keine Öffnung mehr)
    this._roomWalls(NORTH, [{ side: "south", from: -D, to: D }]);
    this._roomWalls(EAST,  [{ side: "west",  from: -D, to: D }]);

    // Dunkle Platinen-Boden-Hülle unter allem.
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      makeCircuitMaterial(0x06140c, 180, 180)
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(0, -0.06, 0);
    base.receiveShadow = true;
    this.group.add(base);

    this.doors = [];
    // Zeit-Tore: pro Raum ein Kraftfeld in der Tür-Öffnung. Offen NUR zwischen den
    // Wellen; während einer Welle geschlossen. EINSEITIG: aus dem Raum kommt man
    // immer raus (keine Einsperrung), aber von der Arena nicht rein.
    this.gates = [];
    for (const gd of [
      { room: NORTH, box: { minX: -D, maxX: D, minZ: -30, maxZ: -26 } }, // Workstation
      { room: EAST,  box: { minX: 26, maxX: 30, minZ: -D, maxZ: D } },   // Waffen
    ]) this._addGate(gd.box, gd.room);
    this.setGatesOpen(true);
  }

  // Ein Zeit-Tor: leuchtendes Kraftfeld-Panel in der Tür-Öffnung + Kollisions-AABB.
  // exitZone = Raum + Korridor → solange der Spieler dort ist, bleibt das Tor offen.
  _addGate(b, room) {
    const w = b.maxX - b.minX, dp = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(w, 0.4), 3.6, Math.max(dp, 0.4)),
      new THREE.MeshStandardMaterial({
        color: 0x331016, emissive: 0xff3b52, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.55, roughness: 0.4,
      })
    );
    mesh.position.set(cx, 1.8, cz);
    this.group.add(mesh);
    const exitZone = {
      minX: Math.min(room.minX, b.minX), maxX: Math.max(room.maxX, b.maxX),
      minZ: Math.min(room.minZ, b.minZ), maxZ: Math.max(room.maxZ, b.maxZ),
    };
    this.gates.push({ mesh, wallBox: { ...b }, exitZone });
  }

  // Tore öffnen/schließen. Bei geschlossenem Zustand bleibt ein Tor durchlässig,
  // solange der Spieler in dessen Raum/Korridor steht (rauslassen, kein Soft-Lock).
  setGatesOpen(open, px = null, pz = null) {
    for (const g of this.gates) {
      const z = g.exitZone;
      const inZone = px !== null && px >= z.minX && px <= z.maxX && pz >= z.minZ && pz <= z.maxZ;
      const pass = open || inZone;
      const i = this.walls.indexOf(g.wallBox);
      if (pass) { if (i >= 0) this.walls.splice(i, 1); }
      else { if (i < 0) this.walls.push(g.wallBox); }
      g.mesh.visible = !open; // Panel sichtbar, sobald eine Welle läuft
    }
  }

  // Eine verschlossene Tür: Mesh (sichtbare Sperre) + Kollisions-AABB in der
  // Tuerluecke. Freischalten entfernt beides.
  _addDoor(d) {
    const b = d.box;
    const w = b.maxX - b.minX, dp = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(w, 3.6, dp),
      new THREE.MeshStandardMaterial({ color: 0x2a1320, emissive: 0xff3355, emissiveIntensity: 0.3, roughness: 0.6, metalness: 0.3 })
    );
    door.position.set(cx, 1.8, cz);
    door.castShadow = true;
    door.receiveShadow = true;
    const sign = new THREE.Sprite(makeDoorIcon("🔒"));
    sign.scale.set(2.4, 2.4, 1);
    sign.position.set(cx, 4.0, cz);
    this.group.add(door, sign);
    const wallBox = { ...b };
    this.walls.push(wallBox); // blockiert das Durchlaufen
    this.doors.push({ name: d.name, label: d.label, price: d.price, mesh: door, sign, wallBox, locked: true, cx, cz, r: Math.max(w, dp) / 2 + 4 });
  }

  // Tür in Reichweite (für Prompt/Interaktion); null wenn keine gesperrte nah.
  lockedDoorNear(x, z) {
    for (const d of this.doors || []) {
      if (d.locked && Math.hypot(x - d.cx, z - d.cz) <= d.r) return d;
    }
    return null;
  }

  // Tür öffnen: Kollisions-Wand + Mesh entfernen. Gibt true bei Erfolg.
  unlockDoor(name) {
    const d = (this.doors || []).find((e) => e.name === name);
    if (!d || !d.locked) return false;
    d.locked = false;
    const i = this.walls.indexOf(d.wallBox);
    if (i >= 0) this.walls.splice(i, 1);
    this.group.remove(d.mesh, d.sign);
    return true;
  }

  // Beim Spielstart bereits gekaufte Räume (aus Meta) ohne Kosten öffnen.
  applyUnlocked(names = []) {
    for (const n of names) this.unlockDoor(n);
  }

  // ------------------------------------------------------------- Bau-Helfer --
  _floor(r, color, grid, theme = "tech") {
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
    const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.4, d),
      makeCircuitMaterial(color, w, d) // Platinen-Boden (PC-Inneres)
    );
    slab.position.set(cx, r.y - 0.2, cz);
    slab.receiveShadow = true;
    this.group.add(slab);

    // Leuchtende Bodenkante als Raumumrandung.
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.08, d + 0.2),
      new THREE.MeshBasicMaterial({ color: NEON })
    );
    edge.position.set(cx, r.y + 0.06, cz);
    edge.renderOrder = -1;
    // Nur als dünner Rahmen sichtbar: über dem Slab, leicht transparent.
    edge.material.transparent = true;
    edge.material.opacity = 0.12;
    edge.material.depthWrite = false; // kein Z-Fighting gegen den Slab
    edge.material.polygonOffset = true;
    edge.material.polygonOffsetFactor = -1;
    edge.material.polygonOffsetUnits = -1;
    this.group.add(edge);

    if (grid) {
      const g = new THREE.GridHelper(Math.max(w, d), CONFIG.arena.grid, CONFIG.colors.gridMain, CONFIG.colors.gridSub);
      g.position.set(cx, r.y + 0.03, cz);
      g.material.transparent = true;
      g.material.opacity = 0.5;
      g.material.depthWrite = false; // kein Z-Fighting gegen Slab/Kante
      g.material.polygonOffset = true;
      g.material.polygonOffsetFactor = -1;
      g.material.polygonOffsetUnits = -1;
      this.group.add(g);
    }

    this.slabs.push({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, y: r.y });
  }

  _connector(minX, maxX, minZ, maxZ, y) {
    const w = maxX - minX, d = maxZ - minZ;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.4, d),
      makeFloorMaterial("tech", 0x232b3c, Math.max(w, 2), Math.max(d, 2))
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
      makeFloorMaterial("tech", 0x283250, w, Math.hypot(len, yHigh - yLow))
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

// Emoji-Sprite-Material (für Tür-Schloss-Icon).
function makeDoorIcon(emoji) {
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
