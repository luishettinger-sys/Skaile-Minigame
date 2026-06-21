// Cult-of-the-Lamb-Atmosphäre für die Arena: bewusst SYMMETRISCH & aufgeräumt
// statt verstreut. Ein Ritual-Sigill am Boden, Kerzen in zwei konzentrischen
// Quadraten und Kult-Banner an den Wänden. Dunkel, kerzenwarm, okkult.
// Wirft Schatten (castShadow) und glüht (emissive → Bloom). Rein dekorativ.
import * as THREE from "three";

const stone = (c = 0x1a1622) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0.05 });
const wax = (c = 0xe8dcc2) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
const flameMat = () => new THREE.MeshBasicMaterial({ color: 0xffb24a });
// depthWrite:false + polygonOffset → flache Glüh-Decals flackern nicht gegen den Boden.
const glowMat = (hex) => new THREE.MeshBasicMaterial({
  color: hex, transparent: true, opacity: 0.55, fog: false,
  depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

function shade(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

export function buildDeskProps(scene) {
  const group = new THREE.Group();

  group.add(ritualSigil(0, 0, 7.5));      // zentrales okkultes Sigill (flach, blockiert nicht)

  // Hinweis: Die Stein-Fackeln (Braziers) und Kandelaber sind jetzt KI-Hero-Assets
  // (Higgsfield→Blender), platziert in main.js inkl. warmem Punktlicht + Glühen.
  // Hier bleiben nur Sigill + Wand-Banner.

  // Kult-Banner an den vier Wänden (über den Tür-Öffnungen, hängen hoch).
  group.add(banner(0, -27.4, 0));          // Nord
  group.add(banner(0, 27.4, Math.PI));     // Süd
  group.add(banner(-27.4, 0, Math.PI / 2));// West
  group.add(banner(27.4, 0, -Math.PI / 2));// Ost

  shade(group);
  scene.add(group);
  return group;
}

// --- Ritual-Sigill: konzentrische glühende Ringe + Radialstrahlen ----------
function ritualSigil(x, z, r) {
  const g = new THREE.Group();
  const ringMat = glowMat(0xc2487a);   // okkultes Magenta
  const ringMat2 = glowMat(0x6ee7ff);  // kalter Akzent
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 8, 64), ringMat);
  const midRing = new THREE.Mesh(new THREE.TorusGeometry(r * 0.66, 0.09, 8, 56), ringMat2);
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(r * 0.33, 0.07, 8, 40), ringMat);
  for (const ring of [outerRing, midRing, innerRing]) { ring.rotation.x = -Math.PI / 2; ring.position.y = 0.14; ring.renderOrder = 2; g.add(ring); }
  // Radialstrahlen (Pentagramm-Andeutung) zwischen den Ringen.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const ray = new THREE.Mesh(new THREE.BoxGeometry(r * 0.6, 0.04, 0.08), glowMat(0x8a3a6a));
    ray.renderOrder = 2;
    ray.position.set(Math.cos(a) * r * 0.66, 0.12, Math.sin(a) * r * 0.66);
    ray.rotation.y = -a;
    g.add(ray);
  }
  g.position.set(x, 0, z);
  return g;
}

// --- Kerze: gestapeltes Wachs + Flamme (emissive) + warmer Glow + opt. Licht
function candle(x, z, height, withLight) {
  const g = new THREE.Group();
  // Niedriger Steinsockel (verankert die Kerze optisch).
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.4, 12), stone(0x221a26));
  base.position.y = 0.2;
  // Wachssäule mit leichten „Tropfen".
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, height, 14), wax());
  body.position.y = 0.4 + height / 2;
  const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14), wax(0xd8c8a8));
  drip.position.y = 0.4 + height - 0.2;
  // Docht + Flamme.
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 10), flameMat());
  flame.position.y = 0.4 + height + 0.25;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), glowMat(0xffcaa0));
  halo.position.copy(flame.position);
  g.add(base, body, drip, flame, halo);
  if (withLight) {
    const light = new THREE.PointLight(0xffb869, 14, 22, 2);
    light.position.set(0, 0.4 + height + 0.3, 0);
    g.add(light);
  }
  g.position.set(x, 0, z);
  return g;
}

// --- Stein-Fackel (Brazier): Säule + Feuerschale + Flammen + warmes Licht ---
function brazier(x, z) {
  const g = new THREE.Group();
  const st = stone(0x271d2c);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 0.7, 12), st);
  base.position.y = 0.35;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.05, 3.3, 12), st);
  col.position.y = 2.1;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.0, 1.0, 16, 1, true), stone(0x14100e));
  bowl.position.y = 4.0;
  g.add(base, col, bowl);
  // Flammen: gestapelte emissive Kegel (Bloom greift sie auf).
  const fireCols = [0xff7a1e, 0xff9d3a, 0xffc24a];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(0.62 - i * 0.06, 1.7 - i * 0.16, 8),
      new THREE.MeshBasicMaterial({ color: fireCols[i % 3] })
    );
    const a = (i / 6) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.35, 4.5 + i * 0.16, Math.sin(a) * 0.35);
    f.rotation.x = Math.cos(a) * 0.18;
    f.rotation.z = Math.sin(a) * 0.18;
    g.add(f);
  }
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), glowMat(0xffb060));
  halo.position.y = 4.7;
  const light = new THREE.PointLight(0xffa64d, 30, 32, 2);
  light.position.y = 4.8;
  g.add(halo, light);
  g.position.set(x, 0, z);
  return g;
}

// --- Kult-Banner: dunkles Tuch an Stange mit glühendem Sigil ---------------
function banner(x, z, rotY) {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 5.2),
    new THREE.MeshStandardMaterial({ color: 0x3a0f1c, roughness: 0.85, side: THREE.DoubleSide })
  );
  cloth.position.y = 3.4;
  // Spitzes unteres Ende (Wimpel-Andeutung).
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 1.2, 3),
    new THREE.MeshStandardMaterial({ color: 0x3a0f1c, roughness: 0.85, side: THREE.DoubleSide })
  );
  tip.rotation.x = Math.PI; tip.position.set(0, 0.2, 0); tip.rotation.z = Math.PI;
  tip.position.y = 0.8; tip.scale.set(1, 1, 1);
  // Querstange oben.
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.7, metalness: 0.3 }));
  rod.rotation.z = Math.PI / 2; rod.position.y = 6.0;
  // Glühendes Sigil auf dem Tuch (Ente-im-Kreis = unser „Kult der Ente").
  const sigilRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.1, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  sigilRing.position.set(0, 3.6, 0.06);
  const sigilDot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  sigilDot.position.set(0, 3.6, 0.06);
  g.add(cloth, tip, rod, sigilRing, sigilDot);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}
