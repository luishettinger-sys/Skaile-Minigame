// Schmiede (Ost-Raum): permanente Waffen-Mods, gebaut aus Schrott (🔩), den
// Bugs beim Sterben fallen lassen. Jeder Mod ist mehrstufig; höhere Stufen
// kosten progressiv mehr Schrott. Die Mods gelten dauerhaft (meta.craftedMods)
// und für JEDE Waffe – sie reihen sich in die normale Mod-Kette ein.

export const FORGE_MODS = {
  power: {
    name: "Brennkammer", icon: "🔥", max: 5, baseCost: 6,
    per: (lvl) => ({ dmgMult: 1 + lvl * 0.1 }),
    desc: (lvl) => `+${lvl * 10}% Schaden`,
  },
  tempo: {
    name: "Takt-Verstärker", icon: "⚡", max: 5, baseCost: 6,
    per: (lvl) => ({ fireMult: Math.pow(0.92, lvl) }),
    desc: (lvl) => `+${Math.round((1 - Math.pow(0.92, lvl)) * 100)}% Feuerrate`,
  },
  crit: {
    name: "Crit-Chip", icon: "💥", max: 4, baseCost: 8,
    per: (lvl) => ({ critAdd: lvl * 0.08 }),
    desc: (lvl) => `+${lvl * 8}% Krit-Chance`,
  },
  pierce: {
    name: "Durchschuss-Spule", icon: "🎯", max: 3, baseCost: 10,
    per: (lvl) => ({ pierceAdd: lvl }),
    desc: (lvl) => `+${lvl} Durchschlag`,
  },
  fork: {
    name: "Fork-Modul", icon: "🔱", max: 3, baseCost: 14,
    per: (lvl) => ({ projAdd: lvl }),
    desc: (lvl) => `+${lvl} Geschoss`,
  },
  range: {
    name: "Fokus-Linse", icon: "🔭", max: 3, baseCost: 8,
    per: (lvl) => ({ rangeMult: 1 + lvl * 0.15 }),
    desc: (lvl) => `+${lvl * 15}% Reichweite`,
  },
};

export const FORGE_ORDER = ["power", "tempo", "crit", "pierce", "fork", "range"];

// Kosten fürs NÄCHSTE Level (steigt mit der aktuellen Stufe).
export function forgeCost(id, curLvl) {
  const d = FORGE_MODS[id];
  if (!d) return Infinity;
  return Math.round(d.baseCost * Math.pow(1.7, curLvl));
}
