// Wellen-Manager: eskalierendes Budget, Typ-Freischaltung, Pausen.
import { CONFIG } from "./config.js";
import { pickWeighted } from "./utils.js";

// Gegner-Roster: Kosten (gegen Wellen-Budget), ab welcher Welle freigeschaltet,
// und Spawn-Gewicht.
const ROSTER = [
  { type: "syntax", cost: 1, unlock: 1, weight: 10 },
  { type: "racecondition", cost: 2, unlock: 2, weight: 6 },
  { type: "memoryleak", cost: 2, unlock: 3, weight: 5 },
  { type: "stackoverflow", cost: 3, unlock: 4, weight: 4 },
  { type: "heisenbug", cost: 3, unlock: 5, weight: 4 },
  { type: "infinite", cost: 2, unlock: 6, weight: 5 },
  { type: "nullptr", cost: 2, unlock: 7, weight: 5 },
];

export class WaveManager {
  constructor({ onSpawn, onWaveStart, onWaveClear }) {
    this.onSpawn = onSpawn;
    this.onWaveStart = onWaveStart;
    this.onWaveClear = onWaveClear;
    this.reset();
  }

  reset() {
    this.wave = 0;
    this.state = "break"; // "break" | "spawning"
    this.timer = 1.5; // kurze Vorlaufzeit bis Welle 1
    this.budget = 0;
    this.spawnTimer = 0;
  }

  // Auf Anforderung sofort die nächste Welle starten (opt-in "Deploy").
  beginNow() {
    this._beginWave();
  }

  _beginWave() {
    this.wave++;
    this.budget =
      CONFIG.waves.startBudget + CONFIG.waves.budgetGrowth * (this.wave - 1);
    this.state = "spawning";
    this.spawnTimer = 0;
    this.onWaveStart?.(this.wave);
  }

  // Affordable + freigeschaltete Typen gewichtet auswählen.
  _pickType() {
    const options = ROSTER.filter(
      (r) => r.unlock <= this.wave && r.cost <= this.budget
    ).map((r) => ({ value: r, weight: r.weight }));
    if (options.length === 0) return null;
    return pickWeighted(options);
  }

  update(dt, aliveCount) {
    if (this.state === "break") {
      this.timer -= dt;
      if (this.timer <= 0) this._beginWave();
      return;
    }

    // state === "spawning"
    this.spawnTimer -= dt;
    if (
      this.budget > 0 &&
      aliveCount < CONFIG.waves.maxAlive &&
      this.spawnTimer <= 0
    ) {
      const r = this._pickType();
      if (r) {
        this.onSpawn?.(r.type);
        this.budget -= r.cost;
        // Spawn-Tempo zieht in späteren Wellen leicht an.
        this.spawnTimer =
          CONFIG.waves.spawnInterval * Math.max(0.4, 1 - this.wave * 0.03);
      }
    }

    // Welle vorbei: Budget leer UND alle Gegner besiegt.
    if (this.budget <= 0 && aliveCount === 0) {
      this.state = "break";
      this.timer = CONFIG.waves.breakTime;
      this.onWaveClear?.(this.wave);
    }
  }
}
