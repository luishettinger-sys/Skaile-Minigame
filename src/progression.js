// Roguelite-Progression: XP, Level-Ups und die Upgrade-Auswahl.
import { CONFIG } from "./config.js";

// Wenige, klare Power-Ups – jedes kann beim Level-Up immer wieder gewählt werden
// und stapelt sich (auflevelbar). Bewusst melee-/movement-fokussiert.
export const UPGRADES = [
  { id: "damage", name: "Mehr Schaden", desc: "+2 Schaden pro Treffer", icon: "💥",
    apply: (m) => { m.dmgAdd += 2; } },
  { id: "rapid", name: "Schneller Schlag", desc: "-15 % Angriffspause", icon: "⚔️",
    apply: (m) => { m.fireMult *= 0.85; } },
  { id: "speed", name: "Flinke Füße", desc: "+12 % Lauftempo", icon: "🦶",
    apply: (m) => { m.moveSpeedMult *= 1.12; } },
  { id: "maxhp", name: "Extra-Herz", desc: "+1 Herz (und heilen)", icon: "❤️",
    apply: (m, p) => { m.maxHpAdd += 10; if (p) p.hp += 10; } },
  { id: "crit", name: "Crit-Chance", desc: "+12 % kritische Treffer", icon: "🔥",
    apply: (m) => { m.critAdd += 0.12; } },
  { id: "haste", name: "Schneller Dash", desc: "-25 % Dash-Abklingzeit", icon: "💨",
    apply: (m) => { m.dashCdMult *= 0.75; } },
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
