// Einrichtung der freischaltbaren Räume – jeder bekommt eine eigene, AUFGERÄUMTE
// Themen-Möblierung (an Wänden / symmetrisch, kein Random-Chaos), passend zum
// Cult-of-the-Lamb + Dev-Theme. Rein prozedural, wirft Schatten.
import * as THREE from "three";

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...o });
const glow = (hex) => new THREE.MeshBasicMaterial({ color: hex });

function shade(o) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }

// rooms = building.rooms (name -> {minX,maxX,minZ,maxZ,y})
export function buildRoomDecor(scene, rooms) {
  const group = new THREE.Group();
  if (rooms) {
    if (rooms.lounge) lounge(group, rooms.lounge);
    if (rooms.lab) lab(group, rooms.lab);
    if (rooms.puzzle) puzzle(group, rooms.puzzle);
    if (rooms.server) server(group, rooms.server);
    if (rooms.vault) vault(group, rooms.vault);
    if (rooms.armory) armoryDecor(group, rooms.armory);
  }
  shade(group);
  scene.add(group);
  return group;
}

// Hilfen: Zentrum + Wandpositionen eines Raums.
const cx = (r) => (r.minX + r.maxX) / 2;
const cz = (r) => (r.minZ + r.maxZ) / 2;

// === LOUNGE: gemütlicher Kult-Aufenthaltsraum (Sofa, Teppich, Tisch, Regal) ==
function lounge(group, r) {
  const g = new THREE.Group();
  const y = r.y;
  // Teppich (großes flaches Rechteck, violett-okkult).
  const rug = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 9), M(0x3a1c4a, { roughness: 1 }));
  rug.position.set(0, y + 0.06, 0);
  g.add(rug);
  // Sofa an der Rückwand (West).
  g.add(sofa(-9, y, 0, Math.PI / 2));
  // Niedriger Tisch mit Kerze.
  const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 2.2), M(0x4a3520));
  table.position.set(-3, y + 1.0, 0);
  const legMat = M(0x2a1d14);
  for (const [lx, lz] of [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 0.25), legMat);
    leg.position.set(-3 + lx, y + 0.5, lz); g.add(leg);
  }
  const tcandle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.9, 12), M(0xe8dcc2));
  tcandle.position.set(-3, y + 1.65, 0);
  const tflame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 8), glow(0xffb24a));
  tflame.position.set(-3, y + 2.3, 0);
  const tlight = new THREE.PointLight(0xffb869, 9, 16, 2); tlight.position.set(-3, y + 2.4, 0);
  g.add(table, tcandle, tflame, tlight);
  // Bücherregal an der Ostwand.
  g.add(bookshelf(9.5, y, 0, -Math.PI / 2));
  g.position.set(cx(r), 0, cz(r));
  group.add(g);
}

function sofa(x, y, z, rot) {
  const g = new THREE.Group();
  const mat = M(0x6a2342, { roughness: 0.9 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 2.2), mat); seat.position.y = 0.9;
  const back = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 0.6), mat); back.position.set(0, 1.5, -0.8);
  const aL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 2.2), mat); aL.position.set(-2.3, 1.2, 0);
  const aR = aL.clone(); aR.position.x = 2.3;
  g.add(seat, back, aL, aR);
  g.position.set(x, y, z); g.rotation.y = rot;
  return g;
}

function bookshelf(x, y, z, rot) {
  const g = new THREE.Group();
  const wood = M(0x3a2818);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 5), wood); frame.position.y = 2.5;
  g.add(frame);
  const bookCols = [0x8a2d3b, 0x2d6a8a, 0xc49a2a, 0x4a7a3a, 0x6a3a7a];
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 6; i++) {
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.28), M(bookCols[(s + i) % 5]));
      bk.position.set(0.15, 1.0 + s * 1.4, -1.8 + i * 0.62);
      bk.rotation.z = (Math.random() - 0.5) * 0.08;
      g.add(bk);
    }
  }
  g.position.set(x, y, z); g.rotation.y = rot;
  return g;
}

// === LAB: okkultes Dev-Labor (Mainframe, leuchtende Tanks, Konsole) =========
function lab(group, r) {
  const g = new THREE.Group();
  const y = r.y;
  // Mainframe-Säule an der Nordwand.
  const mf = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 2), M(0x12161f, { metalness: 0.5, roughness: 0.5 }));
  mf.position.set(0, y + 3, -8); // an der Nordwand (relativ zum Raumzentrum)
  g.add(mf);
  const leds = [0x80ed99, 0x6ee7ff, 0xffd23f, 0xff5470];
  for (let i = 0; i < 14; i++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), glow(leds[i % 4]));
    led.position.set(-1.4 + (i % 3) * 0.7, y + 1.2 + Math.floor(i / 3) * 0.9, -7);
    g.add(led);
  }
  // Zwei leuchtende Flüssigkeits-Tanks (Bug-Proben), symmetrisch.
  for (const sx of [-7, 7]) g.add(tank(sx, y, -7));
  // Konsole mit grünem Screen.
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 2), M(0x1a1f2a));
  console_.position.set(0, y + 0.6, 3);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.0), glow(0x39ff9a));
  scr.position.set(0, y + 1.4, 3.1); scr.rotation.x = -0.4;
  g.add(console_, scr);
  g.position.set(cx(r), 0, cz(r));
  group.add(g);
}

function tank(x, y, z) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.5, 16), M(0x20242e)); base.position.y = 0.25;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 3.4, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x39ff9a, transparent: true, opacity: 0.35, emissive: 0x1a7a4a, emissiveIntensity: 0.6 }));
  glass.position.y = 2.3;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.4, 16), M(0x20242e)); cap.position.y = 4.1;
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), glow(0x80ed99)); blob.position.y = 2.0;
  g.add(base, glass, cap, blob);
  g.position.set(x, y, z);
  return g;
}

// === PUZZLE: Runen-Ritualraum (Pfeiler im Kreis + Mittel-Pedestal) ==========
function puzzle(group, r) {
  const g = new THREE.Group();
  const y = r.y;
  // Pedestal mit schwebendem grünem Kristall.
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 1.6, 6), M(0x1f2a22, { metalness: 0.3 }));
  ped.position.y = y + 0.8;
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.0), glow(0x39ff9a));
  crystal.position.y = y + 3.0; crystal.scale.y = 1.6;
  g.add(ped, crystal);
  // 6 Runen-Pfeiler im Kreis.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pil = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.2, 1.1), M(0x24302a));
    pil.position.set(Math.cos(a) * 7, y + 1.6, Math.sin(a) * 7);
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), glow(0x80ed99));
    rune.position.set(Math.cos(a) * 6.4, y + 2.0, Math.sin(a) * 6.4);
    rune.lookAt(0, y + 2.0, 0);
    g.add(pil, rune);
  }
  g.position.set(cx(r), 0, cz(r));
  group.add(g);
}

// === SERVER: Server-Reihen + zentraler Mainframe ============================
function server(group, r) {
  const g = new THREE.Group();
  const y = r.y;
  for (const sx of [-8, 8]) {
    for (let i = 0; i < 3; i++) g.add(rack(sx, y, -6 + i * 6));
  }
  g.position.set(cx(r), 0, cz(r));
  group.add(g);
}

function rack(x, y, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 2.4), M(0x0f1320, { metalness: 0.5 }));
  body.position.y = y + 3;
  g.add(body);
  const cols = [0x6ee7ff, 0x80ed99, 0xffd23f];
  for (let i = 0; i < 12; i++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.05), glow(cols[i % 3]));
    led.position.set(-0.9 + (i % 2) * 0.5, y + 1.0 + Math.floor(i / 2) * 0.85, 1.25);
    g.add(led);
  }
  g.position.set(x, 0, z);
  return g;
}

// === VAULT: Schatzkammer (Gold, Truhen, Reliquie) – lohnendes Reward ========
function vault(group, r) {
  const g = new THREE.Group();
  const y = r.y;
  // Reliquien-Pedestal mit leuchtendem goldenen Ei (Enten-Relikt).
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.0, 8), M(0x3a2e10, { metalness: 0.4 }));
  ped.position.y = y + 1.0;
  const relic = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 14), M(0xffd23f, { metalness: 0.9, roughness: 0.25 }));
  relic.position.y = y + 3.2; relic.scale.y = 1.3;
  const rlight = new THREE.PointLight(0xffd23f, 12, 18, 2); rlight.position.y = y + 3.2;
  g.add(ped, relic, rlight);
  // Goldhaufen + Truhen symmetrisch.
  for (const sx of [-9, 9]) {
    g.add(goldPile(sx, y, -6));
    g.add(chest(sx, y, 6));
  }
  // Gold-Barren-Stapel an der Rückwand.
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.8), M(0xffcf3a, { metalness: 0.85, roughness: 0.3 }));
    bar.position.set(-1 + i, y + 0.25, -12);
    g.add(bar);
  }
  g.position.set(cx(r), 0, cz(r));
  group.add(g);
}

function goldPile(x, y, z) {
  const g = new THREE.Group();
  // Alles relativ zur Gruppe; Gruppe wird ans Ziel gesetzt.
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.6, 16), M(0xffcf3a, { metalness: 0.85, roughness: 0.3 }));
  cone.position.y = 0.8;
  g.add(cone);
  for (let i = 0; i < 12; i++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), M(0xffe066, { metalness: 0.9, roughness: 0.25 }));
    const a = (i / 12) * Math.PI * 2, rad = 1.2 + (i % 3) * 0.4;
    coin.position.set(Math.cos(a) * rad, 0.05, Math.sin(a) * rad);
    coin.rotation.set(Math.PI / 2, 0, a);
    g.add(coin);
  }
  g.position.set(x, y, z);
  return g;
}

function chest(x, y, z) {
  const g = new THREE.Group();
  const wood = M(0x5a3a1a, { metalness: 0.2 });
  const gold = M(0xffcf3a, { metalness: 0.8, roughness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.6), wood); box.position.y = 0.7;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 12, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2; lid.position.y = 1.4;
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.25, 1.7), gold); band.position.y = 0.9;
  g.add(box, lid, band);
  g.position.set(x, y, z);
  return g;
}

// === ARMORY: Banner + Amboss (hat schon Waffen-Podeste) =====================
function armoryDecor(group, r) {
  const g = new THREE.Group();
  const y = r.y;
  // Amboss.
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.9), M(0x1a1a20, { metalness: 0.6 }));
  base.position.set(0, y + 0.5, 8);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.0), M(0x26262e, { metalness: 0.7 }));
  top.position.set(0.3, y + 1.2, 8);
  g.add(base, top);
  // Zwei Waffen-Wandständer (Kreuz aus Stangen) an der Rückwand.
  for (const sx of [-9, 9]) {
    const rackBack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), M(0x2a1218));
    rackBack.position.set(sx, y + 2, -12);
    g.add(rackBack);
  }
  g.position.set(cx(r), 0, cz(r));
  group.add(g);
}
