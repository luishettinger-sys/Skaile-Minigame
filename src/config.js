// ============================================================================
//  DUCK & DEBUG — zentrale Spielwerte
//  Alles Balancing lebt hier. Ein Ort, eine Wahrheit.
// ============================================================================

export const CONFIG = {
  // Gebäude-Skalierung: 1 = kompakter Hauptraum (kein langes Rumlaufen).
  buildScale: 1,

  // Sicht-Radius (Fog of War): wie weit man sehen kann; der Rest ist schwarz und
  // deckt sich beim Näherkommen auf. Per Level-Up erweiterbar.
  vision: { base: 62, perLevel: 6, max: 120 }, // größerer Sicht-Radius → mehr Überblick

  arena: {
    half: 22, // halbe Spawn-Kantenlänge (kompakter Hauptraum ±26)
    grid: 44, // Grid-Linien (Schaltkreis-Look)
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
      lunger: true, lungeInterval: 2.4, // springt häufiger (aggressiver)
    },
    racecondition: {
      label: "Race Condition",
      hp: 2, speed: 6.4, radius: 0.8, damage: 9, score: 25,
      color: 0x00f5d4, glow: 0x8ffff0, scale: 0.95, splits: 2,
      strafe: 0.9, // webt unberechenbar quer (race = nicht-deterministisch)
    },
    memoryleak: {
      label: "Memory Leak",
      hp: 3, speed: 2.4, radius: 1.0, damage: 10, score: 20,
      color: 0x80ed99, glow: 0xc6ffd4, scale: 1.15, leaksTrail: true,
      trailInterval: 0.5, // hinterlässt giftige Speicher-Pfützen (Schaden)
    },
    heisenbug: {
      label: "Heisenbug",
      hp: 1, speed: 5.6, radius: 0.85, damage: 14, score: 50,
      color: 0xff6ec7, glow: 0xffc2ec, scale: 1.0, flickers: true, fly: true,
      blink: true, // teleportiert in Sprüngen statt smooth zu laufen
    },
    infinite: {
      label: "Infinite Loop",
      hp: 2, speed: 4.6, radius: 0.9, damage: 10, score: 30,
      color: 0x9b5de5, glow: 0xc8a2ff, scale: 1.0,
      orbit: true, orbitRange: 22, // umkreist den Spieler (Endlosschleife)
    },
    nullptr: {
      label: "Null Pointer",
      hp: 2, speed: 4.4, radius: 0.85, damage: 12, score: 35,
      color: 0x4a5bff, glow: 0x9bb0ff, scale: 1.0, fly: true,
      ranged: true, shootInterval: 1.3, shootRange: 34, // schießt häufiger Void-Bolts
      kite: 22, // hält Abstand und feuert (Kiting)
    },
    // --- 5 verschiedene Bosse (1 pro Sektor: Welle 5/10/15/20/25) -------------
    // Jeder hat ein eigenes Angriffsmuster (attack) + eigenen Bewegungsstil; die
    // Muster werden mit der Welle dichter/schneller (Skalierung in enemies.js).
    boss: { // Welle 5 – Kernel Panic: Schuss-Fächer + Slam-Sprung
      label: "Kernel Panic",
      hp: 120, speed: 2.3, radius: 2.6, damage: 26, score: 500,
      color: 0xff3355, glow: 0xff8899, scale: 3.4, isBoss: true,
      ranged: true, attack: "fan", shootInterval: 2.4, shootRange: 110,
      lunger: true, lungeInterval: 4.2,
    },
    bossNull: { // Welle 10 – Null Daemon: gezielte Schnellsalven + Teleport
      label: "Null Daemon",
      hp: 175, speed: 3.4, radius: 2.4, damage: 24, score: 650,
      color: 0x4a5bff, glow: 0x9bb0ff, scale: 3.2, isBoss: true,
      ranged: true, attack: "aimed", shootInterval: 1.9, shootRange: 120, blink: true,
    },
    bossStack: { // Welle 15 – Stack Smasher: Radial-Bullet-Hell + ruft Adds
      label: "Stack Smasher",
      hp: 250, speed: 1.9, radius: 2.9, damage: 28, score: 800,
      color: 0x9b5de5, glow: 0xc89bff, scale: 3.8, isBoss: true,
      ranged: true, attack: "radial", shootInterval: 2.3, shootRange: 140,
      summon: "syntax", summonInterval: 6, lunger: true, lungeInterval: 6,
    },
    bossRace: { // Welle 20 – Race Daemon: rotierender Spiral-Stream + erratisch
      label: "Race Daemon",
      hp: 320, speed: 4.4, radius: 2.3, damage: 26, score: 950,
      color: 0x00f5d4, glow: 0x8ffff0, scale: 3.0, isBoss: true,
      ranged: true, attack: "spiral", shootInterval: 0.11, shootRange: 200, strafe: 0.7,
    },
    bossFinal: { // Welle 25 – The Segfault: alles kombiniert (Finale)
      label: "The Segfault",
      hp: 440, speed: 2.6, radius: 3.2, damage: 34, score: 1500,
      color: 0xff3355, glow: 0xffd23f, scale: 4.2, isBoss: true,
      ranged: true, attack: "combo", shootInterval: 1.6, shootRange: 220,
      lunger: true, lungeInterval: 4, summon: "racecondition", summonInterval: 7,
    },
    bonus: {
      label: "Bonus Bug",
      hp: 3, speed: 7.8, radius: 0.7, damage: 0, score: 0,
      color: 0xffd23f, glow: 0xfff3b0, scale: 0.9, flee: true, ttl: 9,
    },
  },

  waves: {
    startBudget: 14, // "Punkte" Gegner-Wert in Welle 1
    budgetGrowth: 14, // +Budget pro Welle (steile Eskalation → Farming-Loop wird hart)
    spawnInterval: 0.3, // schnelle Spawns → dichte Schwärme
    breakTime: 10, // ~10s Pause zwischen Wellen → Türen offen, Zeit zum Shoppen
    maxAlive: 75, // Obergrenze gleichzeitiger Gegner
    bossEvery: 5, // alle N Wellen erscheint ein Boss
  },

  // Großes Ziel: Das Gebäude Sektor für Sektor zurückerobern. Jeder Boss
  // (alle bossEvery Wellen) säubert einen Sektor; nach dem letzten Sektor
  // ist das Gebäude befreit → Sieg (danach optional endlos weiter).
  campaign: {
    sectors: 5, // Anzahl Sektoren bis zum Sieg
    sectorNames: [
      "Der I/O-Port", "Die RAM-Bänke", "Der GPU-Kern", "Der CPU-Die", "Der Kernel",
    ],
    get finalWave() { return CONFIG.waves.bossEvery * this.sectors; }, // = 25
  },

  // Skalierung pro Welle – das Spiel wird spürbar schwerer und größer.
  difficulty: {
    hpPerWave: 0.22, // +22 % Gegner-HP pro Welle (zäher mit jeder Welle)
    speedPerWave: 0.04, // +4 % Gegner-Tempo pro Welle
    speedMax: 2.1, // Tempo-Deckel höher → späte Wellen flott
    arenaGrowth: 0, // Arena wächst nicht mehr (kompakt halten)
    arenaMax: 24, // maximale Halbkante (innerhalb der Arena-Wände ±26)
  },

  progression: {
    baseXp: 5, // XP für Level 2
    growth: 4, // zusätzlicher XP-Bedarf pro Level
  },

  pickups: {
    magnet: 10, // großer Einsammel-Radius → Drops liegen nicht lange rum (Übersicht)
    collectRadius: 1.7,
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
    offset: { x: 0, y: 17, z: 17 }, // flacher 3/4-Blick (~45°) → Entengesicht & Brille sichtbar, Waffe liest sich
    followLerp: 7, // etwas träger → die Kamera schwenkt sichtbarer mit (dynamischer)
    fov: 46, // minimal weiter → mehr Tempo-Gefühl
    hover: 0.32, // mehr Schweben → lebendigere, „atmende" Kamera
    hoverSpeed: 1.15,
  },

  colors: {
    bg: 0x05060a, // Void-Schwarz: außerhalb der Sichtweite (Fog of War)
    fog: 0x05060a,
    floor: 0x3a4250,
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
