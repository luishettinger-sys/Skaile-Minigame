// Roguelite-Progression: XP, Level-Ups und die Upgrade-Auswahl.
import { CONFIG } from "./config.js";

// Alle wählbaren Upgrades. apply() mutiert das stats-Objekt (und ggf. player).
export const UPGRADES = [
  { id: "rapid", name: "Schnellfeuer", desc: "-15 % Schussintervall", icon: "⚡",
    apply: (s) => { s.fireInterval *= 0.85; } },
  { id: "damage", name: "Mehr Bumms", desc: "+1 Schaden pro Treffer", icon: "💥",
    apply: (s) => { s.damage += 1; } },
  { id: "multishot", name: "Multishot", desc: "+1 Geschoss pro Schuss", icon: "🔱",
    apply: (s) => { s.projCount += 1; } },
  { id: "pierce", name: "Durchschlag", desc: "Geschosse durchschlagen +1 Bug", icon: "🎯",
    apply: (s) => { s.pierce += 1; } },
  { id: "speed", name: "Flinke Füße", desc: "+12 % Bewegungstempo", icon: "🦶",
    apply: (s) => { s.moveSpeed *= 1.12; } },
  { id: "maxhp", name: "Robuster Build", desc: "+25 max HP (und heilen)", icon: "❤️",
    apply: (s, p) => { s.maxHp += 25; p.maxHp = s.maxHp; p.hp = Math.min(s.maxHp, p.hp + 25); } },
  { id: "magnet", name: "Magnetente", desc: "+50 % Einsammel-Radius", icon: "🧲",
    apply: (s) => { s.magnet *= 1.5; } },
  { id: "bigshot", name: "Dicke Geschosse", desc: "+30 % Geschossgröße", icon: "⭕",
    apply: (s) => { s.projScale *= 1.3; } },
  { id: "regen", name: "Auto-Debug", desc: "+1 HP / Sekunde", icon: "♻️",
    apply: (s) => { s.regen += 1; } },
  { id: "haste", name: "Turbo-Dash", desc: "-25 % Dash-Cooldown", icon: "💨",
    apply: (s) => { s.dashCooldown *= 0.75; } },
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
