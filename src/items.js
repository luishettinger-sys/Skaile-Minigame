// Loot-Items (Dev-Hardware-Chips). Ausgerüstet geben sie Stat-Boni.
// mods-Felder mit Suffix "Mult" werden multipliziert, sonst addiert.

export function defaultMods() {
  return {
    fireMult: 1, dmgAdd: 0, dmgMult: 1, projAdd: 0, pierceAdd: 0,
    projScaleMult: 1, moveSpeedMult: 1, magnetMult: 1, regen: 0,
    dashCdMult: 1, maxHpAdd: 0,
    energyMult: 1, critAdd: 0, projSpeedMult: 1, spreadMult: 1,
  };
}

// Zwei mods-Objekte kombinieren (Mult multiplizieren, Rest addieren).
export function mergeMods(into, extra) {
  for (const k in extra) {
    if (k.endsWith("Mult")) into[k] *= extra[k];
    else into[k] += extra[k];
  }
  return into;
}

export const ITEM_DEFS = [
  { id: "cpu", name: "Overclocked CPU", icon: "🧠", desc: "+15 % Schaden", mods: { dmgMult: 1.15 } },
  { id: "gpu", name: "GPU-Boost", icon: "🟥", desc: "+1 Schaden", mods: { dmgAdd: 1 } },
  { id: "ram", name: "RAM-Riegel", icon: "🟩", desc: "+11 % Feuerrate", mods: { fireMult: 0.9 } },
  { id: "ssd", name: "SSD-Cache", icon: "💾", desc: "+10 % Tempo", mods: { moveSpeedMult: 1.1 } },
  { id: "cooler", name: "Heatsink", icon: "❄️", desc: "+1 HP/Sek", mods: { regen: 1 } },
  { id: "magnet", name: "Coil-Magnet", icon: "🧲", desc: "+40 % Magnet", mods: { magnetMult: 1.4 } },
  { id: "firewall", name: "Firewall-Chip", icon: "🛡️", desc: "+20 max HP", mods: { maxHpAdd: 20 } },
  { id: "focus", name: "Laser-Fokus", icon: "🎯", desc: "+1 Durchschlag", mods: { pierceAdd: 1 } },
  { id: "fork", name: "Fork-Modul", icon: "🔱", desc: "+1 Geschoss", mods: { projAdd: 1 } },
  { id: "turbo", name: "Turbo-Lüfter", icon: "💨", desc: "-20 % Dash-CD", mods: { dashCdMult: 0.8 } },
];

let _uid = 0;

// Ein zufälliges Item (mit eindeutiger uid fürs Inventar) erzeugen.
export function rollItem() {
  const d = ITEM_DEFS[Math.floor(Math.random() * ITEM_DEFS.length)];
  return { ...d, uid: ++_uid };
}
