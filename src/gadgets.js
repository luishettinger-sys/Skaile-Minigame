// Gadgets: im Shop kaufbar, stapelbar (Stufen). Es ist immer nur EINS aktiv
// (mit Taste G durchschalten); das aktive Gadget gibt seinen Bonus + Optik.
export const GADGETS = {
  boots: {
    icon: "🚀", name: "Raketenstiefel", desc: "schneller laufen (stapelbar)",
    apply: (m, lvl) => { m.moveSpeedMult *= 1 + 0.12 * lvl; },
  },
  overclock: {
    icon: "⏱️", name: "Overclock-Chip", desc: "höhere Feuerrate",
    apply: (m, lvl) => { m.fireMult *= Math.pow(0.9, lvl); },
  },
  armor: {
    icon: "🦺", name: "Nano-Panzer", desc: "mehr max HP",
    apply: (m, lvl) => { m.maxHpAdd += 25 * lvl; },
  },
  magnet: {
    icon: "🧲", name: "Magnet-Kern", desc: "größerer Einsammel-Radius",
    apply: (m, lvl) => { m.magnetMult *= 1 + 0.3 * lvl; },
  },
  thrusters: {
    icon: "💨", name: "Dash-Booster", desc: "kürzerer Dash-Cooldown",
    apply: (m, lvl) => { m.dashCdMult *= Math.pow(0.85, lvl); },
  },
};

export const GADGET_IDS = Object.keys(GADGETS);

export function gadgetPrice(level) {
  return 50 + level * 45;
}
