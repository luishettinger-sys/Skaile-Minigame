// ============================================================================
//  DUCK & DEBUG — zentrale Spielwerte
//  Alles Balancing lebt hier. Ein Ort, eine Wahrheit.
// ============================================================================

export const CONFIG = {
  arena: {
    half: 22, // halbe Kantenlänge → größeres Spielfeld
    grid: 44, // Anzahl Grid-Linien (Code-Grid-Optik)
  },

  player: {
    speed: 12, // Bewegungsgeschwindigkeit (Einheiten/Sekunde)
    radius: 0.9, // Kollisionsradius
    turnLerp: 16, // wie schnell sich die Ente in Laufrichtung dreht
    maxHp: 100,
    hitInvuln: 0.9, // Sekunden Unverwundbarkeit nach Treffer
    bigHitDamage: 15, // ab so viel Schaden pro Treffer: zusätzliches "Ouch"-Voice
    contactKnockback: 6,
    regen: 0, // HP/Sekunde (per Upgrade erhöhbar)
    dash: {
      mult: 2.8, // Geschwindigkeits-Multiplikator während des Dash
      duration: 0.18,
      cooldown: 1.1,
      iframes: 0.32, // Unverwundbarkeit während/nach dem Dash
    },
  },

  weapon: {
    fireInterval: 0.15, // Sekunden zwischen Schüssen (manuell, gehalten)
    projSpeed: 52,
    projRadius: 0.32,
    projLen: 1.5, // Länge des Geschosses (echtes Projektil statt Kugel)
    projLife: 1.1,
    damage: 1,
    muzzleForward: 1.3, // wie weit vor der Ente das Geschoss erscheint
    projCount: 1, // Geschosse pro Schuss (Multishot-Upgrade)
    spread: 0.14, // Streuung in Radiant bei mehreren Geschossen
    pierce: 0, // wie viele zusätzliche Gegner ein Geschoss durchschlägt
  },

  // Energie statt Dauerfeuer: Schießen kostet Energie, die nachlädt.
  energy: {
    max: 100,
    regen: 44, // Energie/Sekunde
    regenDelay: 0.35, // Sekunden nach letztem Schuss bis Regeneration startet
    aimRange: 42, // Reichweite der automatischen Ausrichtung
    aimTurn: 16, // wie schnell die Ente auf das Ziel schwenkt
  },

  // "Juice": Crits, Hit-Stop, automatische Perspektivwechsel.
  juice: {
    critChance: 0.16,
    critMult: 2,
    hitStopKill: 0.04, // kurzes Einfrieren bei Kill
    hitStopBoss: 0.12, // stärker bei Boss-Treffern
    hitStopHurt: 0.09, // wenn die Ente getroffen wird
    autoCamInterval: 16, // Sekunden zwischen kurzen Auto-Perspektivwechseln
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
      lunger: true, lungeInterval: 3.2, // setzt zum Sprung an
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
      color: 0xff6ec7, glow: 0xffc2ec, scale: 1.0, flickers: true, fly: true,
    },
    infinite: {
      label: "Infinite Loop",
      hp: 2, speed: 4.6, radius: 0.9, damage: 10, score: 30,
      color: 0x9b5de5, glow: 0xc8a2ff, scale: 1.0,
    },
    nullptr: {
      label: "Null Pointer",
      hp: 2, speed: 4.4, radius: 0.85, damage: 12, score: 35,
      color: 0x4a5bff, glow: 0x9bb0ff, scale: 1.0, fly: true,
      ranged: true, shootInterval: 2.0, shootRange: 32, // schießt Void-Bolts
    },
    boss: {
      label: "Kernel Panic",
      hp: 120, speed: 2.3, radius: 2.6, damage: 26, score: 500,
      color: 0xff3355, glow: 0xff8899, scale: 3.4, isBoss: true,
      ranged: true, shootInterval: 2.6, shootRange: 95, // Schuss-Fächer
      lunger: true, lungeInterval: 4.5, // Slam-Sprung
    },
    bonus: {
      label: "Bonus Bug",
      hp: 3, speed: 7.8, radius: 0.7, damage: 0, score: 0,
      color: 0xffd23f, glow: 0xfff3b0, scale: 0.9, flee: true, ttl: 9,
    },
  },

  waves: {
    startBudget: 6, // "Punkte" Gegner-Wert in Welle 1
    budgetGrowth: 6, // +Budget pro Welle (steiler → schwerer)
    spawnInterval: 1.0, // Sekunden zwischen Spawns innerhalb einer Welle
    breakTime: 2.5, // Pause zwischen Wellen
    maxAlive: 85, // harte Obergrenze gleichzeitiger Gegner (Performance)
    bossEvery: 5, // alle N Wellen erscheint ein Boss
  },

  // Großes Ziel: Das Gebäude Sektor für Sektor zurückerobern. Jeder Boss
  // (alle bossEvery Wellen) säubert einen Sektor; nach dem letzten Sektor
  // ist das Gebäude befreit → Sieg (danach optional endlos weiter).
  campaign: {
    sectors: 5, // Anzahl Sektoren bis zum Sieg
    sectorNames: [
      "Großraumbüro", "Server-Raum", "Nacht-Office", "Rechenzentrum", "Der Kernel",
    ],
    get finalWave() { return CONFIG.waves.bossEvery * this.sectors; }, // = 25
  },

  // Skalierung pro Welle – das Spiel wird spürbar schwerer und größer.
  difficulty: {
    hpPerWave: 0.16, // +16 % Gegner-HP pro Welle
    speedPerWave: 0.03, // +3 % Gegner-Tempo pro Welle
    speedMax: 1.7, // Tempo-Deckel
    arenaGrowth: 2.2, // +Einheiten Arena-Halbkante pro Welle
    arenaMax: 60, // maximale Halbkante
  },

  progression: {
    baseXp: 5, // XP für Level 2
    growth: 4, // zusätzlicher XP-Bedarf pro Level
  },

  pickups: {
    magnet: 4.5, // Einsammel-Radius (per Upgrade erhöhbar)
    collectRadius: 1.3,
    gemValue: 1, // XP pro Gem
    healAmount: 25, // HP pro Health-Drop
    healthDropChance: 0.06, // Wahrscheinlichkeit, dass ein Bug Health droppt
  },

  combo: {
    decayTime: 2.6, // Sekunden ohne Kill bis Combo fällt
    ultPerKill: 1, // Ladung pro Kill
    ultThreshold: 28, // Kills bis Ultimate bereit
    ultDuration: 4.0, // Dauer "Rubber Duck Moment"
    ultSlowmo: 0.28, // Zeitfaktor während Ultimate
  },

  camera: {
    // Cult-of-the-Lamb-Blick: steil & ruhig von oben, flaches FOV → storybook-haft,
    // wenig Perspektiv-Verzerrung, Fokus klar auf der Ente.
    offset: { x: 0, y: 22, z: 14 }, // steiler (≈58° von der Waagerechten) + weiter weg
    followLerp: 6, // träge → ruhig, kein Zittern
    fov: 42, // flacher Blick, fast „2.5D" – CotL-Look
    hover: 0.08, // kaum Schweben → ruhige, gesetzte Kamera
    hoverSpeed: 1.0,
  },

  colors: {
    bg: 0x140b18, // okkultes Dunkel-Violett (Cult-of-the-Lamb-Stimmung)
    fog: 0x140b18,
    floor: 0x12151d,
    gridMain: 0x4a2c54, // okkultes Violett statt Blau
    gridSub: 0x251830,
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
