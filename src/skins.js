// Kaufbare Duck-Skins: in Blender recolorierte Albedo-Texturen + Material-Overrides.
// Werden zur Laufzeit auf das geladene Enten-GLB angewandt (Texture-Swap statt
// eigener GLBs → minimaler Download).
import * as THREE from "three";

export const SKINS = {
  classic:  { label: "Classic",   emoji: "🐤", price: 0,    map: null },
  gold:     { label: "Gold",      emoji: "🏅", price: 600,  map: "./assets/skins/duck_gold.webp",     metalness: 0.85, roughness: 0.28 },
  camo:     { label: "Camo",      emoji: "🪖", price: 900,  map: "./assets/skins/duck_camo.webp",     metalness: 0.0,  roughness: 0.85 },
  blackops: { label: "Black Ops", emoji: "🥷", price: 1200, map: "./assets/skins/duck_blackops.webp", metalness: 0.25, roughness: 0.6 },
  chrome:   { label: "Chrome",    emoji: "🪞", price: 1800, map: "./assets/skins/duck_chrome.webp",   metalness: 1.0,  roughness: 0.12 },
  toxic:    { label: "Toxic",     emoji: "☢️", price: 2500, map: "./assets/skins/duck_toxic.webp",    metalness: 0.1,  roughness: 0.5, emissive: 0x66ff22, emissiveIntensity: 0.7, emissiveFromMap: true },
};

// Reihenfolge (classic frei, Rest per Claude-Rätsel freischalten).
export const SKIN_ORDER = ["classic", "gold", "camo", "blackops", "chrome", "toxic"];

// Skins werden NICHT mehr mit Coins gekauft, sondern durch das Beantworten einer
// kleinen Claude-/KI-Rätselfrage freigeschaltet (3 Optionen, eine richtig).
export const SKIN_RIDDLES = {
  gold:     { q: "Welche Firma steckt hinter Claude?", options: ["Anthropic", "OpenAI", "Google"], answer: "Anthropic" },
  camo:     { q: "Was ist Claude?", options: ["Ein KI-Sprachmodell", "Eine Suchmaschine", "Ein Betriebssystem"], answer: "Ein KI-Sprachmodell" },
  blackops: { q: "Claude ist (u.a.) benannt nach dem Informationstheorie-Pionier …", options: ["Claude Shannon", "Alan Turing", "Ada Lovelace"], answer: "Claude Shannon" },
  chrome:   { q: "Wie heißt die Technik, bei der Menschen KI-Antworten bewerten?", options: ["RLHF", "SQL", "HTTP"], answer: "RLHF" },
  toxic:    { q: "Wie nennt Anthropic seinen KI-Sicherheits-Ansatz?", options: ["Constitutional AI", "Firewall AI", "Antivirus AI"], answer: "Constitutional AI" },
};

// Texturen einmalig laden + cachen. flipY=false wegen GLB-UV-Konvention.
const _cache = new Map();
const _loader = new THREE.TextureLoader();
export function loadSkinTexture(url) {
  if (_cache.has(url)) return _cache.get(url);
  const tex = _loader.load(url);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _cache.set(url, tex);
  return tex;
}
