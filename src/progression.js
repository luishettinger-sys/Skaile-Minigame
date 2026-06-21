// Roguelite-Progression: XP, Level-Ups und die Upgrade-Auswahl.
import { CONFIG } from "./config.js";

// Alle wählbaren Upgrades. apply() mutiert das stats-Objekt (und ggf. player).
export const UPGRADES = [
  { id: "rapid", name: "Schnellfeuer", desc: "-15 % Schussintervall", icon: "⚡",
    apply: (m) => { m.fireMult *= 0.85; } },
  { id: "damage", name: "Mehr Bumms", desc: "+1 Schaden pro Treffer", icon: "💥",
    apply: (m) => { m.dmgAdd += 1; } },
  { id: "multishot", name: "Multishot", desc: "+1 Geschoss pro Schuss", icon: "🔱",
    apply: (m) => { m.projAdd += 1; } },
  { id: "pierce", name: "Durchschlag", desc: "Geschosse durchschlagen +1 Bug", icon: "🎯",
    apply: (m) => { m.pierceAdd += 1; } },
  { id: "speed", name: "Flinke Füße", desc: "+12 % Bewegungstempo", icon: "🦶",
    apply: (m) => { m.moveSpeedMult *= 1.12; } },
  { id: "maxhp", name: "Robuster Build", desc: "+25 max HP (und heilen)", icon: "❤️",
    apply: (m, p) => { m.maxHpAdd += 25; p.hp += 25; } },
  { id: "magnet", name: "Magnetente", desc: "+50 % Einsammel-Radius", icon: "🧲",
    apply: (m) => { m.magnetMult *= 1.5; } },
  { id: "bigshot", name: "Dicke Geschosse", desc: "+30 % Geschossgröße", icon: "⭕",
    apply: (m) => { m.projScaleMult *= 1.3; } },
  { id: "regen", name: "Auto-Debug", desc: "+1 HP / Sekunde", icon: "♻️",
    apply: (m) => { m.regen += 1; } },
  { id: "damageMult", name: "Crit-Build", desc: "+25 % Gesamtschaden", icon: "🔥",
    apply: (m) => { m.dmgMult *= 1.25; } },
  { id: "haste", name: "Turbo-Dash", desc: "-25 % Dash-Cooldown", icon: "💨",
    apply: (m) => { m.dashCdMult *= 0.75; } },
  { id: "efficient", name: "Effizienz-Kern", desc: "-20 % Energiekosten", icon: "🔋",
    apply: (m) => { m.energyMult *= 0.8; } },
  { id: "crit", name: "Crit-Chip", desc: "+10 % Crit-Chance", icon: "🎲",
    apply: (m) => { m.critAdd += 0.1; } },
  { id: "velocity", name: "Schub-Modul", desc: "+25 % Geschoss-Tempo", icon: "🚀",
    apply: (m) => { m.projSpeedMult *= 1.25; } },
  { id: "range", name: "Zielfernrohr", desc: "+30 % Reichweite", icon: "🔭",
    apply: (m) => { m.rangeMult *= 1.3; } },
  { id: "accuracy", name: "Ziel-Stabilisator", desc: "-25 % Streuung", icon: "📐",
    apply: (m) => { m.spreadMult *= 0.75; } },
  { id: "glass", name: "Glaskanone", desc: "+40 % Schaden, -15 max HP", icon: "⚗️",
    apply: (m, p) => { m.dmgMult *= 1.4; m.maxHpAdd -= 15; if (p) p.hp = Math.max(10, p.hp - 15); } },
  { id: "bulwark", name: "Bollwerk", desc: "+40 max HP (und heilen)", icon: "🧱",
    apply: (m, p) => { m.maxHpAdd += 40; if (p) p.hp += 40; } },
];

export class Progression {
  constructor() {
    this.reset();
  }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.xpToNext = CONFIG.progression.baseXp;
  }

  // Gibt die Anzahl der erreichten Level-Ups zurück.
  addXp(n) {
    this.xp += n;
    let leveled = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      leveled++;
      this.xpToNext = CONFIG.progression.baseXp + CONFIG.progression.growth * (this.level - 1);
    }
    return leveled;
  }

  ratio() {
    return Math.min(1, this.xp / this.xpToNext);
  }

  // n verschiedene zufällige Upgrades zur Auswahl.
  roll(n = 3) {
    const pool = [...UPGRADES];
    const out = [];
    while (out.length < n && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }
}
