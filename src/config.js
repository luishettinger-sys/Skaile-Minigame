// ============================================================================
//  DUCK & DEBUG — zentrale Spielwerte
//  Alles Balancing lebt hier. Ein Ort, eine Wahrheit.
// ============================================================================

export const CONFIG = {
  arena: {
    half: 18, // halbe Kantenlänge → Spielfeld 36 x 36 Einheiten
    grid: 36, // Anzahl Grid-Linien (Code-Grid-Optik)
  },

  player: {
    speed: 12, // Bewegungsgeschwindigkeit (Einheiten/Sekunde)
    radius: 0.9, // Kollisionsradius
    turnLerp: 16, // wie schnell sich die Ente in Laufrichtung dreht
    maxHp: 100,
    hitInvuln: 0.9, // Sekunden Unverwundbarkeit nach Treffer
    contactKnockback: 6,
  },

  weapon: {
    fireInterval: 0.15, // Sekunden zwischen Schüssen (manuell, gehalten)
    projSpeed: 52,
    projRadius: 0.32,
    projLen: 1.5, // Länge des Geschosses (echtes Projektil statt Kugel)
    projLife: 1.1,
    damage: 1,
    muzzleForward: 1.3, // wie weit vor der Ente das Geschoss erscheint
  },

  // Bug-Monster — jedes verkörpert einen Dev-Schmerz
  enemies: {
    syntax: {
      label: "Syntax Error",
      hp: 1, speed: 5.0, radius: 0.85, damage: 8, score: 10,
      color: 0xff5470, glow: 0xff90a8, scale: 1.0,
    },
    stackoverflow: {
      label: "Stack Overflow",
      hp: 4, speed: 2.9, radius: 1.35, damage: 16, score: 35,
      color: 0x9b5de5, glow: 0xc89bff, scale: 1.6,
    },
    racecondition: {
      label: "Race Condition",
      hp: 2, speed: 6.4, radius: 0.8, damage: 9, score: 25,
      color: 0x00f5d4, glow: 0x8ffff0, scale: 0.95, splits: 2,
    },
    memoryleak: {
      label: "Memory Leak",
      hp: 3, speed: 2.4, radius: 1.0, damage: 10, score: 20,
      color: 0x80ed99, glow: 0xc6ffd4, scale: 1.15, leaksTrail: true,
    },
    heisenbug: {
      label: "Heisenbug",
      hp: 1, speed: 5.6, radius: 0.85, damage: 14, score: 50,
      color: 0xff6ec7, glow: 0xffc2ec, scale: 1.0, flickers: true,
    },
  },

  waves: {
    startBudget: 6, // "Punkte" Gegner-Wert in Welle 1
    budgetGrowth: 4, // +Budget pro Welle
    spawnInterval: 1.1, // Sekunden zwischen Spawns innerhalb einer Welle
    breakTime: 3.0, // Pause zwischen Wellen
    maxAlive: 60, // harte Obergrenze gleichzeitiger Gegner (Performance)
  },

  combo: {
    decayTime: 2.6, // Sekunden ohne Kill bis Combo fällt
    ultPerKill: 1, // Ladung pro Kill
    ultThreshold: 28, // Kills bis Ultimate bereit
    ultDuration: 4.0, // Dauer "Rubber Duck Moment"
    ultSlowmo: 0.28, // Zeitfaktor während Ultimate
  },

  camera: {
    // Drohnen-Blick: schwebt nah über/hinter der Ente und fliegt mit.
    offset: { x: 0, y: 15, z: 12 },
    followLerp: 7,
    fov: 58,
    hover: 0.4, // sanftes Auf/Ab der "Drohne"
    hoverSpeed: 1.6,
  },

  colors: {
    bg: 0x0b0d12,
    fog: 0x0b0d12,
    floor: 0x12151d,
    gridMain: 0x2b3550,
    gridSub: 0x191d2b,
    border: 0x6ee7ff,
    cyan: 0x6ee7ff,
    red: 0xff5470,
    pink: 0xff6ec7,
    green: 0x80ed99,
    duckBody: 0xffd23f,
    duckBeak: 0xff8c1a,
    duckEye: 0x10131a,
    projectile: 0xfff3b0,
  },
};
