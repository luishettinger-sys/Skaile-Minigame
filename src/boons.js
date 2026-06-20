// Run-Boons: build-definierende Verstärkungen, die alle paar Wellen zur Wahl
// stehen (1 aus 3). Gelten nur im aktuellen Run, stapeln sich → jeder Run
// bekommt einen eigenen "Build". Unterschied zu Level-Up-Upgrades: seltener,
// dafür wuchtiger und mit Trade-offs.
//
// def.mods  → wird in die Run-Mods gemerged (Mult multipliziert, Rest addiert).
// def.special → Sondereffekt, vom Game gesondert behandelt (Lifesteal etc.).

export const BOONS = {
  multishot: {
    icon: "🔱", name: "Fork-Bomb", desc: "+1 Geschoss pro Schuss",
    mods: { projAdd: 1 },
  },
  glasscannon: {
    icon: "💎", name: "Glaskanone", desc: "+45 % Schaden, aber −25 max HP",
    mods: { dmgMult: 1.45, maxHpAdd: -25 },
  },
  vampire: {
    icon: "🧛", name: "Vampir-Modus", desc: "Heile 2 HP pro Kill",
    special: "lifesteal", amount: 2,
  },
  adrenaline: {
    icon: "⚡", name: "Adrenalin", desc: "+15 % Tempo, +11 % Feuerrate",
    mods: { moveSpeedMult: 1.15, fireMult: 0.9 },
  },
  bulwark: {
    icon: "🛡️", name: "Bollwerk", desc: "+35 max HP, +1 HP/Sek",
    mods: { maxHpAdd: 35, regen: 1 },
  },
  sniper: {
    icon: "🎯", name: "Scharfschütze", desc: "+8 % Krit, +1 Durchschlag",
    mods: { critAdd: 0.08, pierceAdd: 1 },
  },
  swarm: {
    icon: "🤖", name: "Drohnen-Schwarm", desc: "+1 Angriffs-Drohne",
    special: "drone",
  },
  greed: {
    icon: "🪙", name: "Gierschlund", desc: "+60 % Coins von Bugs",
    special: "coinMult", amount: 1.6,
  },
  overcharge: {
    icon: "💨", name: "Überladung", desc: "+25 % Projektil-Tempo & -Größe",
    mods: { projSpeedMult: 1.25, projScaleMult: 1.25 },
  },
  magfield: {
    icon: "🧲", name: "Magnetfeld", desc: "+50 % Sammelradius",
    mods: { magnetMult: 1.5 },
  },
};

export const BOON_IDS = Object.keys(BOONS);

// n verschiedene Boons zufällig ziehen (für die Auswahlkarten).
export function rollBoons(n = 3) {
  const pool = [...BOON_IDS];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const id = pool.splice(idx, 1)[0];
    out.push({ id, ...BOONS[id] });
  }
  return out;
}
