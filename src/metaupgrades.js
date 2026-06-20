// Permanente Lab-Ausbauten (Meta-Progression). Werden mit der BANK (meta.coins)
// gekauft, bleiben dauerhaft und gelten in jedem Run – das Herzstück des
// Roguelite-Loops: jeder Tod zahlt auf dauerhaften Fortschritt ein.
//
// Jede Stufe wirkt kumulativ. mod(level, m) schreibt den Gesamteffekt der
// gekauften Stufen in ein defaultMods()-Objekt. "startcoins" ist Spezialfall
// (kein Kampf-Mod) und wird im Game beim Run-Start eingelöst.
import { defaultMods, mergeMods } from "./items.js";

export const META_UPGRADES = {
  maxhp: {
    icon: "❤️", name: "Build Health", short: "+20 max HP / Stufe",
    max: 8, base: 180, step: 110,
    mod: (lvl, m) => { m.maxHpAdd += 20 * lvl; },
  },
  damage: {
    icon: "💥", name: "Schaden", short: "+8 % Schaden / Stufe",
    max: 8, base: 220, step: 150,
    mod: (lvl, m) => { m.dmgMult *= 1 + 0.08 * lvl; },
  },
  firerate: {
    icon: "⚡", name: "Feuerrate", short: "+6 % Feuerrate / Stufe",
    max: 6, base: 240, step: 160,
    mod: (lvl, m) => { m.fireMult *= Math.pow(0.94, lvl); },
  },
  speed: {
    icon: "🏃", name: "Lauftempo", short: "+5 % Tempo / Stufe",
    max: 5, base: 180, step: 130,
    mod: (lvl, m) => { m.moveSpeedMult *= 1 + 0.05 * lvl; },
  },
  magnet: {
    icon: "🧲", name: "Magnet", short: "+20 % Sammelradius / Stufe",
    max: 5, base: 140, step: 90,
    mod: (lvl, m) => { m.magnetMult *= 1 + 0.2 * lvl; },
  },
  regen: {
    icon: "🩹", name: "Regeneration", short: "+1 HP/Sek / Stufe",
    max: 5, base: 260, step: 180,
    mod: (lvl, m) => { m.regen += 1 * lvl; },
  },
  crit: {
    icon: "🎯", name: "Krit-Chance", short: "+4 % Krit / Stufe",
    max: 5, base: 280, step: 170,
    mod: (lvl, m) => { m.critAdd += 0.04 * lvl; },
  },
  startcoins: {
    icon: "🪙", name: "Startkapital", short: "+60 Run-Coins zu Start",
    max: 6, base: 160, step: 120,
    special: "startcoins", perLevel: 60,
  },
};

// Reihenfolge im Lab-Ausbau-Menü.
export const META_ORDER = [
  "maxhp", "damage", "firerate", "speed", "magnet", "regen", "crit", "startcoins",
];

// Preis der NÄCHSTEN Stufe (level = aktuell gekaufte Stufen).
export function metaPrice(def, level) {
  return def.base + def.step * level;
}

// Mods aus allen gekauften Meta-Stufen kombinieren.
export function metaMods(levels = {}) {
  const m = defaultMods();
  for (const key in META_UPGRADES) {
    const def = META_UPGRADES[key];
    const lvl = levels[key] || 0;
    if (lvl > 0 && def.mod) def.mod(lvl, m);
  }
  return m;
}

// Startkapital aus dem Startcoins-Ausbau.
export function metaStartCoins(levels = {}) {
  const def = META_UPGRADES.startcoins;
  return (levels.startcoins || 0) * def.perLevel;
}
