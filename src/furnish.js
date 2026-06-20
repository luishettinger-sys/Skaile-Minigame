// Büro-Hülle + Hintergrund-Möblierung: lässt das gesamte Areal so wirken, als
// läge alles in EINEM großen Büro. Umlaufende Glas-/Fensterwände, Deckenbeleuchtung
// am Rand und reichlich Office-Props (Cubicles, Server-Racks, Pflanzen, Wasserspender)
// im Raum zwischen/um die begehbaren Räume.
import * as THREE from "three";

// Footprint des Büros (umschließt das gesamte Gebäude großzügig).
const EXT = { minX: -108, maxX: 108, minZ: -150, maxZ: 140 };
const SHELL_H = 22;

export function buildOffice2(scene) {
  const group = new THREE.Group();

  buildShell(group);
  scatterProps(group);

  scene.add(group);
  return group;
}

// --- Büro-Hülle: hohe Wände mit Fensterbändern + Deckenlicht am Rand --------
function buildShell(group) {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.85, metalness: 0.1 });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.32, fog: false });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x141822, roughness: 0.6, metalness: 0.4 });

  const sides = [
    { x: 0, z: EXT.minZ, w: EXT.maxX - EXT.minX, horiz: true },
    { x: 0, z: EXT.maxZ, w: EXT.maxX - EXT.minX, horiz: true },
    { x: EXT.minX, z: 0, w: EXT.maxZ - EXT.minZ, horiz: false },
    { x: EXT.maxX, z: 0, w: EXT.maxZ - EXT.minZ, horiz: false },
  ];
  for (const s of sides) {
    const g = new THREE.Group();
    // Massive Sockel- + Brüstungswand.
    const base = new THREE.Mesh(new THREE.BoxGeometry(s.w, SHELL_H, 0.8), wallMat);
    base.position.y = SHELL_H / 2;
    base.receiveShadow = true;
    g.add(base);

    // Großes Fensterband (Glas) in der Mitte der Wand.
    const glass = new THREE.Mesh(new THREE.BoxGeometry(s.w - 4, 9, 0.3), glassMat);
    glass.position.set(0, 9, 0.4);
    g.add(glass);

    // Vertikale Fensterstreben (Office-Fassade).
    const mullions = Math.floor(s.w / 8);
    for (let i = 1; i < mullions; i++) {
      const mx = -s.w / 2 + (i * s.w) / mullions;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.4, 0.5), frameMat);
      bar.position.set(mx, 9, 0.5);
      g.add(bar);
    }
    // Horizontaler Fenstersturz.
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.8, 0.9), frameMat);
    lintel.position.set(0, 13.8, 0.5);
    g.add(lintel);

    g.position.set(s.x, 0, s.z);
    if (!s.horiz) g.rotation.y = Math.PI / 2;
    group.add(g);
  }

  // Deckenleisten-Leuchten am Rand (lassen das Zentrum für die Top-Down-Kamera frei).
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xdfeaff, fog: false });
  const ring = [
    [0, EXT.minZ + 16, EXT.maxX - EXT.minX - 30, 3],
    [0, EXT.maxZ - 16, EXT.maxX - EXT.minX - 30, 3],
    [EXT.minX + 16, 0, 3, EXT.maxZ - EXT.minZ - 30],
    [EXT.maxX - 16, 0, 3, EXT.maxZ - EXT.minZ - 30],
  ];
  for (const [x, z, w, d] of ring) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), panelMat);
    panel.position.set(x, SHELL_H - 1.5, z);
    group.add(panel);
  }
}

// --- Hintergrund-Möblierung im Raum zwischen/um die Räume --------------------
function scatterProps(group) {
  // Reihen von Cubicles + Schreibtischen in den "Innenhof"-Ecken (nicht begehbar,
  // aber als Office-Kulisse weithin sichtbar).
  const deskZones = [
    { x: 70, z: -70 }, { x: -70, z: -70 }, { x: 78, z: 60 }, { x: -78, z: 60 },
    { x: 0, z: -118 }, { x: 0, z: 110 },
  ];
  for (const z of deskZones) cubicleCluster(group, z.x, z.z);

  // Server-Racks-Reihe als markante Office-IT-Kulisse.
  for (let i = 0; i < 6; i++) serverRack(group, -96 + i * 5.5, 96);
  for (let i = 0; i < 6; i++) serverRack(group, 96 - i * 5.5, -96);

  // Große Büropflanzen in den Ecken.
  for (const [x, z] of [[-98, -140], [98, -140], [-98, 132], [98, 132]]) bigPlant(group, x, z);

  // Wasserspender + Kopierer-Andeutungen verstreut.
  for (const [x, z] of [[60, 0], [-60, 0], [0, 70]]) waterCooler(group, x, z);
}

function cubicleCluster(group, ox, oz) {
  const g = new THREE.Group();
  const partMat = new THREE.MeshStandardMaterial({ color: 0x3a4358, roughness: 0.9 });
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x6b5640, roughness: 0.7 });
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const cx = (c - 0.5) * 9, cz = (r - 0.5) * 9;
      // Trennwände (L-Form).
      const w1 = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 0.25), partMat);
      w1.position.set(cx, 1.1, cz - 2.6);
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 6), partMat);
      w2.position.set(cx - 2.9, 1.1, cz);
      // Schreibtisch + Monitor.
      const desk = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 2.4), deskMat);
      desk.position.set(cx, 1.5, cz);
      const mon = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.4, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.4, metalness: 0.5 })
      );
      mon.position.set(cx, 2.5, cz - 0.7);
      const scr = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.1),
        new THREE.MeshBasicMaterial({ color: 0x1d4ed8 })
      );
      scr.position.set(cx, 2.5, cz - 0.6);
      g.add(w1, w2, desk, mon, scr);
    }
  }
  g.position.set(ox, 0, oz);
  group.add(g);
}

function serverRack(group, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4, 7, 3),
    new THREE.MeshStandardMaterial({ color: 0x0f1320, roughness: 0.6, metalness: 0.5 })
  );
  body.position.y = 3.5;
  body.castShadow = true;
  g.add(body);
  // Blinkende LED-Reihen.
  const colors = [0x80ed99, 0x6ee7ff, 0xffd23f, 0xff5470];
  for (let i = 0; i < 10; i++) {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.18, 0.05),
      new THREE.MeshBasicMaterial({ color: colors[i % colors.length] })
    );
    led.position.set(-1.4 + (i % 2) * 0.5, 1.2 + i * 0.55, 1.55);
    g.add(led);
  }
  g.position.set(x, 0, z);
  group.add(g);
}

function bigPlant(group, x, z) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.4, 3, 18),
    new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.8 })
  );
  pot.position.y = 1.5;
  g.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4d, roughness: 0.7 });
  for (let i = 0; i < 10; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 5, 6), leafMat);
    const a = (i / 10) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.9, 5, Math.sin(a) * 0.9);
    leaf.rotation.z = Math.cos(a) * 0.5;
    leaf.rotation.x = -Math.sin(a) * 0.5;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  group.add(g);
}

function waterCooler(group, x, z) {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.4, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xeef3f7, roughness: 0.5 })
  );
  stand.position.y = 1.2;
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 1.6, 16),
    new THREE.MeshBasicMaterial({ color: 0x6ec6ff, transparent: true, opacity: 0.6 })
  );
  bottle.position.y = 3.1;
  g.add(stand, bottle);
  g.position.set(x, 0, z);
  group.add(g);
}
