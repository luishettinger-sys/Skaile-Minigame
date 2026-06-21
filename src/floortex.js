// PBR-Boden-Materialien: kachelbare Albedo+Normal+Roughness-Texturen (Poly Haven,
// CC0), pro Raum getintet. Gibt dem flachen Boden echte Oberfläche, die Licht
// fängt – bleibt aber leicht (zwei 512px-Sets, ~0,5 MB gesamt).
import * as THREE from "three";

const loader = new THREE.TextureLoader();

// Themen: Kachelgröße in Welt-Einheiten + Material-Charakter.
const SETS = {
  // matt halten: wenig Metalness + gedämpfte Umgebungsreflexion → kein heller
  // Türkis-Glanz, sondern düster-gemalter CotL-Boden.
  tech:   { base: "./assets/textures/floor/tech",   tile: 7, metalness: 0.18, roughness: 1.0, normal: 0.9, env: 0.0 },
  carpet: { base: "./assets/textures/floor/carpet", tile: 5, metalness: 0.0,  roughness: 1.0, normal: 1.2, env: 0.0 },
};

// Raumfarbe behalten (Hue/Sättigung), aber aufhellen, damit die Textur sichtbar
// bleibt – die Original-Farben sind fast schwarz und würden alles platt schlucken.
function liftTint(hex, minL) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 0.95), Math.max(hsl.l, minL));
  return c;
}

function loadMap(url, srgb, rx, rz, aniso) {
  const t = loader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, rz);
  t.anisotropy = aniso;
  return t;
}

// Textur-Trios pro (Thema, Kachelung) cachen → Räume gleicher Größe teilen sich
// die GPU-Texturen (Materialien dürfen Texturen gemeinsam nutzen).
const _texCache = new Map();
function getMaps(theme, s, rx, rz, aniso) {
  const key = `${theme}_${rx}_${rz}`;
  let m = _texCache.get(key);
  if (!m) {
    m = {
      map: loadMap(`${s.base}_diff.jpg`, true, rx, rz, aniso),
      nor: loadMap(`${s.base}_nor.jpg`, false, rx, rz, aniso),
      rough: loadMap(`${s.base}_rough.jpg`, false, rx, rz, aniso),
    };
    _texCache.set(key, m);
  }
  return m;
}

// Material für eine w×d große Bodenfläche im gegebenen Thema, getintet mit tintHex.
export function makeFloorMaterial(theme, tintHex, w, d, aniso = 8) {
  const s = SETS[theme] || SETS.tech;
  const rx = Math.max(1, Math.round(w / s.tile));
  const rz = Math.max(1, Math.round(d / s.tile));
  const maps = getMaps(theme in SETS ? theme : "tech", s, rx, rz, aniso);
  // CotL-Boden: flache DUNKLE Sektorfarbe (volle Kontrolle über Ton & Dunkelheit),
  // Oberflächen-Relief kommt aus Normal+Roughness – die helle Diffuse-Textur wird
  // bewusst NICHT als Albedo genutzt (sonst wäscht sie alles aus).
  const mat = new THREE.MeshStandardMaterial({
    normalMap: maps.nor,
    roughnessMap: maps.rough,
    color: liftTint(tintHex, theme === "carpet" ? 0.11 : 0.12),
    metalness: s.metalness,
    roughness: s.roughness,
    envMapIntensity: s.env,
  });
  mat.normalScale.set(s.normal, s.normal);
  return mat;
}
