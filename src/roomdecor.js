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
  const animated = []; // { mesh, fn(t) } für subtile Maschinen-Animation
  if (rooms) {
    // Jeder Funktionsraum bekommt eine GROSSE Themen-Maschine als Kulisse
    // (steht hinten am Raum, lässt die Raummitte zum Interagieren frei).
    if (rooms.spawner)  workstation(group, rooms.spawner, animated);   // Nord: große zentrale Workstation
    if (rooms.armory)   forgeMachine(group, rooms.armory, animated);   // Ost: Schmiede
  }
  shade(group);
  scene.add(group);
  group.userData.animated = animated;
  return group;
}

// Wand-/Rückseiten-Bezug eines Raums: Punkt nahe der vom Arena abgewandten Wand.
function backOf(r, inset = 4) {
  // Welche Wand ist "hinten" (am weitesten von der Arena/Mitte 0,0)?
  const ax = Math.abs(cx(r)) > Math.abs(cz(r)); // Raum liegt eher in x- oder z-Richtung?
  if (ax) return { x: cx(r) > 0 ? r.maxX - inset : r.minX + inset, z: cz(r), faceX: cx(r) > 0 ? -1 : 1, faceZ: 0 };
  return { x: cx(r), z: cz(r) > 0 ? r.maxZ - inset : r.minZ + inset, faceX: 0, faceZ: cz(r) > 0 ? -1 : 1 };
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

// Emissive Standard-Material (leuchtet wie "eingeschaltet").
const E = (color, intensity = 0.9, o = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5, metalness: 0.3, ...o });

// Maschine ans Raum-Hinterende setzen + zur Mitte ausrichten.
function placeMachine(group, g, r, inset) {
  const b = backOf(r, inset);
  g.position.set(b.x, 0, b.z);
  g.rotation.y = b.faceX !== 0 ? (b.faceX > 0 ? Math.PI / 2 : -Math.PI / 2) : (b.faceZ > 0 ? 0 : Math.PI);
  group.add(g);
}

// === NORD: Chip-Sockel – riesige Motherboard-Wand mit blinkenden Chips =======
function chipMachine(group, r, animated) {
  const g = new THREE.Group(); const y = r.y;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(15, 8.5, 0.6), M(0x0e3a24, { metalness: 0.35, roughness: 0.7 }));
  panel.position.set(0, y + 4.4, 0);
  // großer zentraler CPU-Sockel mit glühendem Die.
  const sock = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 0.5), M(0x14141c, { metalness: 0.7 }));
  sock.position.set(0, y + 4.4, 0.4);
  const die = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.3), E(0x2bd4ff, 0.8));
  die.position.set(0, y + 4.4, 0.65);
  // RAM-Riegel-Reihe.
  for (const sx of [-6.4, -5.4, 5.4, 6.4]) {
    const ram = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.4), M(0x1c5a38, { metalness: 0.4 }));
    ram.position.set(sx, y + 4.4, 0.3); g.add(ram);
  }
  g.add(panel, sock, die);
  // blinkende SMD-Lichter im Raster.
  const lights = []; const cols = [0xff5470, 0x80ed99, 0x6ee7ff, 0xffd23f, 0xc792ea];
  for (let i = 0; i < 40; i++) {
    const lx = -6.5 + (i % 10) * 1.45, ly = (Math.floor(i / 10)) * 1.4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.2), glow(cols[i % cols.length]));
    m.position.set(lx, y + 1.4 + ly, 0.5); g.add(m); lights.push(m);
  }
  placeMachine(group, g, r, 2.4);
  animated.push({ fn: (t) => { for (let i = 0; i < lights.length; i++) lights[i].visible = Math.sin(t * 3 + i * 1.7) > -0.2; die.material.emissiveIntensity = 0.7 + Math.sin(t * 2) * 0.25; } });
}

// === NORD: große zentrale Dev-Workstation – Schreibtisch + Riesen-Monitor =======
function workstation(group, r, animated) {
  const g = new THREE.Group(); const y = r.y;
  const deskMat = M(0x20242e, { metalness: 0.4, roughness: 0.6 });
  const metal   = M(0x33363f, { metalness: 0.7, roughness: 0.4 });
  const black   = M(0x0c0e14, { metalness: 0.5, roughness: 0.5 });

  // Großer Schreibtisch.
  const top = new THREE.Mesh(new THREE.BoxGeometry(12, 0.45, 4.6), deskMat); top.position.y = y + 2.6; g.add(top);
  for (const lx of [-5.4, 5.4]) for (const lz of [-1.9, 1.9]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 0.35), metal);
    leg.position.set(lx, y + 1.3, lz); g.add(leg);
  }

  // Riesen-Monitor: Standfuß + Säule + Gehäuse + Bild.
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.25, 24), metal); foot.position.set(0, y + 2.95, -1.4); g.add(foot);
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.2, 0.55), metal); pole.position.set(0, y + 5.0, -1.4); g.add(pole);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(11.2, 6.6, 0.45), black); bezel.position.set(0, y + 6.6, -1.7); g.add(bezel);

  // Bildschirm mit deinem Community-Screenshot (selbstleuchtend → immer sichtbar).
  const tex = new THREE.TextureLoader().load("./assets/textures/monitor_nord.png");
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 6.0), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.set(0, y + 6.6, -1.47); g.add(screen);          // Front zeigt nach +z (zur Kamera)
  const ml = new THREE.PointLight(0xbfe0ff, 8, 26, 2); ml.position.set(0, y + 6.6, 3.0); g.add(ml);

  // Große Tastatur (mit angedeuteten Tasten) + Maus + Pad.
  const kb = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 1.8), M(0x14161d, { metalness: 0.3 }));
  kb.position.set(-0.8, y + 2.85, 1.2); kb.rotation.x = -0.05; g.add(kb);
  const keys = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.08, 1.5), E(0x2bd4ff, 0.3)); keys.position.set(-0.8, y + 2.98, 1.2); keys.rotation.x = -0.05; g.add(keys);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 1.9), M(0x101218)); pad.position.set(3.9, y + 2.83, 1.2); g.add(pad);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), M(0x14161d, { metalness: 0.3 }));
  mouse.scale.set(0.7, 0.4, 1.1); mouse.position.set(3.9, y + 2.95, 1.2); g.add(mouse);

  // Großer Gaming-Stuhl vor dem Tisch.
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 2.4), M(0x1a1f2a)); seat.position.set(0, y + 1.9, 4.0); g.add(seat);
  const sback = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 0.35), M(0x1a1f2a)); sback.position.set(0, y + 3.4, 5.1); g.add(sback);

  // Zentral im Nord-Raum, leicht zur Rückwand; Bildschirm zeigt zur Raummitte/Kamera.
  g.position.set(cx(r), 0, r.minZ + 7);
  group.add(g);

  animated.push({ fn: (t) => { ml.intensity = 7 + Math.sin(t * 2.4) * 1.2; } });
}

// === WEST: Fabrikator – eingehauster Industrie-3D-Drucker =====================
function fabMachine(group, r, animated) {
  const g = new THREE.Group(); const y = r.y;
  const frameMat = M(0x2b3340, { metalness: 0.7, roughness: 0.35 });   // Alu-Profil
  const darkMat  = M(0x0e1118, { metalness: 0.4, roughness: 0.6 });    // Korpus
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x4fd4ff, transparent: true, opacity: 0.12, metalness: 0.2, roughness: 0.1, side: THREE.DoubleSide });

  // Unterschrank (Elektronik/Schubfach) als solide Basis.
  const cab = new THREE.Mesh(new THREE.BoxGeometry(11, 2.2, 7), darkMat); cab.position.set(0, y + 1.1, 0); g.add(cab);
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.2, 0.2), M(0x1a2030, { metalness: 0.5 })); drawer.position.set(0, y + 1.2, 3.55); g.add(drawer);

  // Eingehauster Rahmen: 4 Alu-Pfosten + Ober-/Querbalken (CoreXY-Look).
  for (const px of [-5, 5]) for (const pz of [-3, 3]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.2, 0.45), frameMat);
    post.position.set(px, y + 5.8, pz); g.add(post);
  }
  for (const pz of [-3, 3]) {
    const tb = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.45, 0.45), frameMat); tb.position.set(0, y + 9.3, pz); g.add(tb);
  }
  // Glas-Seitenwände (Gehäuse) – Seiten + Rückwand, vorne offen für Sicht aufs Bett.
  const sideGeo = new THREE.PlaneGeometry(6, 7);
  for (const px of [-5.2, 5.2]) { const s = new THREE.Mesh(sideGeo, glassMat); s.position.set(px, y + 5.8, 0); s.rotation.y = Math.PI / 2; g.add(s); }
  const backGlass = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 7), glassMat); backGlass.position.set(0, y + 5.8, -3.2); g.add(backGlass);

  // Beheiztes Druckbett (glüht warm) auf einer Hubplattform.
  const bed = new THREE.Mesh(new THREE.BoxGeometry(8, 0.35, 5), E(0xff7a3c, 0.55, { metalness: 0.5, roughness: 0.4 }));
  bed.position.set(0, y + 2.8, 0); g.add(bed);
  const bedlight = new THREE.PointLight(0xff7a3c, 4, 12, 2); bedlight.position.set(0, y + 3.4, 0); g.add(bedlight);

  // Obere X-Gantry mit fahrender Brücke + Druckkopf + glühender Düse.
  const gantry = new THREE.Group();
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.4, 0.6), frameMat); bridge.position.y = y + 8.4;
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.2), M(0x3a4150, { metalness: 0.7 })); carriage.position.set(0, y + 8.0, 0);
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 10), E(0x6ee7ff, 1.0)); nozzle.position.set(0, y + 7.3, 0); nozzle.rotation.x = Math.PI;
  gantry.add(bridge, carriage, nozzle); g.add(gantry);

  // Filament-Spule an der Seite (dreht sich).
  const spool = new THREE.Group();
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.7, 24), M(0x101010, { metalness: 0.3 }));
  const fila = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.5, 24), E(0x39ff9a, 0.5)); fila.position.y = 0; reel.add(fila);
  reel.rotation.z = Math.PI / 2; spool.add(reel); spool.position.set(6.2, y + 6.6, -1.5); g.add(spool);

  // Steuer-Display vorne am Pfosten.
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.18), M(0x05070b)); panel.position.set(5.0, y + 4.4, 3.0);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), E(0x39ff9a, 0.7)); scr.position.set(5.0, y + 4.4, 3.1);
  g.add(panel, scr);

  // Halbfertiges Druckobjekt (Schicht-Look) auf dem Bett.
  const wip = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 1.6, 16), E(0x2bd4ff, 0.35, { transparent: true, opacity: 0.8 }));
  wip.position.set(0, y + 3.75, 0); g.add(wip);

  placeMachine(group, g, r, 3.6);
  animated.push({ fn: (t) => {
    const x = Math.sin(t * 1.5) * 3.4;
    gantry.position.x = x; nozzle.position.x = x; carriage.position.x = x;
    nozzle.material.emissiveIntensity = 0.7 + Math.abs(Math.sin(t * 6)) * 0.6;
    reel.rotation.x = t * 0.8;
    scr.material.emissiveIntensity = 0.5 + (Math.sin(t * 3) > 0 ? 0.3 : 0);
  } });
}

// === SÜD: Forschung – Mainframe mit Bildschirmen + rotierender Holo-Säule =====
function researchMachine(group, r, animated) {
  const g = new THREE.Group(); const y = r.y;
  // Schrank-Reihe mit leuchtenden Screen-Panels.
  for (let i = 0; i < 5; i++) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 6.5, 1.4), M(0x141a26, { metalness: 0.5 }));
    cab.position.set(-6 + i * 3, y + 3.25, 0);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 4.6), E([0x2bd4ff, 0x39ff9a, 0xc792ea, 0x6ee7ff, 0x39ff9a][i], 0.6));
    screen.position.set(-6 + i * 3, y + 3.6, 0.72);
    g.add(cab, screen);
  }
  // zentrale Holo-Daten-Säule (dreht sich).
  const colMat = E(0x2bd4ff, 0.7, { transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const holo = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 5.5, 7, 1, true), colMat);
  holo.position.set(0, y + 4.5, 3.5);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.6, 16), M(0x1a2230, { metalness: 0.6 })); base.position.set(0, y + 0.3, 3.5);
  g.add(holo, base);
  placeMachine(group, g, r, 2.6);
  animated.push({ fn: (t) => { holo.rotation.y = t * 0.6; holo.material.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.2; } });
}

// === OST: Schmiede – große Esse/Hochofen hinter dem Amboss ===================
function forgeMachine(group, r, animated) {
  const g = new THREE.Group(); const y = r.y;
  // Ofenkörper.
  const body = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 3.5), M(0x2a2420, { metalness: 0.4, roughness: 0.8 }));
  body.position.set(0, y + 3, 0);
  // glühende Ofenöffnung (pulsiert).
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.5), E(0xff6a1a, 1.2));
  mouth.position.set(0, y + 2.6, 1.6);
  const mlight = new THREE.PointLight(0xff7820, 8, 16, 2); mlight.position.set(0, y + 2.6, 2.4);
  // Schornstein.
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 4, 12), M(0x1f1b18, { metalness: 0.5 }));
  stack.position.set(0, y + 7.5, -0.5);
  g.add(body, mouth, mlight, stack);
  placeMachine(group, g, r, 2.8);
  animated.push({ fn: (t) => { const p = 1.0 + Math.sin(t * 4) * 0.35; mouth.material.emissiveIntensity = p; mlight.intensity = 6 + p * 3; } });
}
