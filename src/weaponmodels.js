// Lädt die in Blender gebauten GLB-Waffenmodelle und stellt normalisierte
// Klone bereit (Lauf zeigt +Z, auf Einheitslänge skaliert, matt/kein Bloom).
// Es gibt 8 Modelle, aber 19 Spielwaffen → Mapping teilt Modelle.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Spielwaffen-ID → GLB-Dateiname (assets/weapons/<file>.glb).
export const WEAPON_MODEL = {
  blaster: "pistol",
  shotgun: "shotgun",
  smg: "smg",
  railgun: "ar",
  cannon: "cannon",
  minigun: "minigun",
  sniper: "sniper",
  trishot: "dualpistol",
  flak: "shotgun",
  pulse: "cannon",
  sawblade: "ar",
  needler: "smg",
  arc: "smg",
  photon: "sniper",
  voidlober: "cannon",
  recursion: "ar",
  nova: "shotgun",
  glitch: "ar",
};

const FILES = ["pistol", "dualpistol", "smg", "ar", "shotgun", "sniper", "minigun", "cannon"];
const cache = {}; // filename -> Object3D (Template, Einheitslänge) | null

// Modell ausrichten: Lauf nach +Z, native Größe behalten (relative Waffengrößen
// bleiben erhalten: Pistole klein, Sniper lang), in eigener Gruppe zentriert.
function normalize(obj) {
  // Blender-Lauf (+Y) wird beim glTF-Export zu -Z → um 180° drehen, damit der
  // Lauf in Blickrichtung der Ente (+Z) zeigt.
  obj.rotation.y = Math.PI;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box.getCenter(center);
  obj.position.sub(center);

  obj.traverse((o) => {
    if (o.isMesh && o.material) {
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        // Kein Eigen-Leuchten → wird vom selektiven Bloom nicht aufgegriffen.
        if (m.emissive) m.emissive.setHex(0x000000);
        if ("emissiveIntensity" in m) m.emissiveIntensity = 0;
        m.needsUpdate = true;
      }
    }
  });

  // Wrapper-Gruppe (ohne eigene Skalierung) → Konsument skaliert sauber auf Länge.
  const g = new THREE.Group();
  g.add(obj);
  return g;
}

// Lädt alle Modelle parallel. Fehlende Dateien werden still übersprungen.
export function loadWeaponModels() {
  const loader = new GLTFLoader();
  return Promise.all(
    FILES.map(
      (name) =>
        new Promise((res) => {
          loader.load(
            `./assets/weapons/${name}.glb`,
            (gltf) => {
              cache[name] = normalize(gltf.scene);
              res();
            },
            undefined,
            (err) => {
              console.warn("[weaponmodels] nicht geladen:", name, err?.message || err);
              cache[name] = null;
              res();
            }
          );
        })
    )
  );
}

// Frischer Klon (Länge ~1) der Waffe für die gegebene Spielwaffen-ID, oder null.
export function cloneWeaponModel(id) {
  const file = WEAPON_MODEL[id];
  if (!file) return null;
  const tpl = cache[file];
  if (!tpl) return null;
  return tpl.clone(true);
}
