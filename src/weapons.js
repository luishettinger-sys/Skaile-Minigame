// Waffen-Arsenal. Jede Waffe definiert Basiswerte; Upgrades (mods) modifizieren
// sie zusätzlich. Geschoss-Optik (Farbe/Größe/Speed) und Sound pro Waffe.
export const WEAPONS = {
  blaster: {
    id: "blaster", name: "Quack-Blaster", icon: "🔫",
    fireInterval: 0.15, damage: 1, projCount: 1, spread: 0.10, pierce: 0,
    projScale: 1.0, speed: 54, color: 0xfff3b0, sound: "blaster", energyCost: 6,
    style: "ball", desc: "Solider Allrounder",
  },
  shotgun: {
    id: "shotgun", name: "Bread-Shotgun", icon: "💥",
    fireInterval: 0.62, damage: 1, projCount: 5, spread: 0.34, pierce: 0,
    projScale: 0.9, speed: 46, color: 0xff8c1a, sound: "shotgun", energyCost: 26,
    style: "pellet", desc: "6 Kugeln, breite Streuung",
  },
  smg: {
    id: "smg", name: "Stack-SMG", icon: "⚡",
    fireInterval: 0.07, damage: 1, projCount: 1, spread: 0.17, pierce: 0,
    projScale: 0.7, speed: 66, color: 0x6ee7ff, sound: "smg", energyCost: 4.6,
    style: "tracer", desc: "Schnelle Salve, dann kurz nachladen",
  },
  railgun: {
    id: "railgun", name: "Nullpointer-Rail", icon: "🎯",
    fireInterval: 0.78, damage: 3, projCount: 1, spread: 0, pierce: 3,
    projScale: 1.1, speed: 98, color: 0xff6ec7, sound: "rail", energyCost: 32,
    style: "laser", desc: "Durchschlägt alles, hoher Schaden",
  },
  cannon: {
    id: "cannon", name: "Heap-Kanone", icon: "🟢",
    fireInterval: 1.0, damage: 2, projCount: 1, spread: 0, pierce: 1,
    projScale: 1.7, speed: 40, color: 0x80ed99, sound: "cannon", energyCost: 36,
    style: "plasma", desc: "Dicke, langsame Brocken",
  },
  minigun: {
    id: "minigun", name: "Loop-Minigun", icon: "🌀",
    fireInterval: 0.05, damage: 1, projCount: 1, spread: 0.22, pierce: 0,
    projScale: 0.65, speed: 72, color: 0xffd23f, sound: "minigun", energyCost: 4.2,
    style: "tracer", desc: "Heißlaufen & spritzen, dann abkühlen",
  },
  sniper: {
    id: "sniper", name: "Segfault-Sniper", icon: "🔭",
    fireInterval: 0.95, damage: 6, projCount: 1, spread: 0, pierce: 2,
    projScale: 1.0, speed: 130, color: 0x6ee7ff, sound: "sniper", energyCost: 26,
    style: "laser", desc: "Präzise, sehr hoher Schaden",
  },
  trishot: {
    id: "trishot", name: "Fork-Trishot", icon: "🔱",
    fireInterval: 0.3, damage: 1, projCount: 3, spread: 0.24, pierce: 0,
    projScale: 0.95, speed: 54, color: 0x9b5de5, sound: "blaster", energyCost: 12,
    style: "ball", desc: "Drei Schüsse im Fächer",
  },
  flak: {
    id: "flak", name: "Exception-Flak", icon: "💢",
    fireInterval: 0.7, damage: 1, projCount: 8, spread: 0.5, pierce: 1,
    projScale: 0.8, speed: 44, color: 0xff5470, sound: "shotgun", energyCost: 26,
    style: "pellet", desc: "8 durchschlagende Splitter, sehr breit",
  },
  pulse: {
    id: "pulse", name: "Async-Pulswelle", icon: "🟣",
    fireInterval: 0.5, damage: 2, projCount: 1, spread: 0, pierce: 3,
    projScale: 1.4, speed: 50, color: 0xc8a2ff, sound: "pulse", energyCost: 18,
    style: "plasma", desc: "Durchschlagende Pulskugel",
  },
  sawblade: {
    id: "sawblade", name: "Sawblade-Disc", icon: "🪚",
    fireInterval: 0.5, damage: 2, projCount: 1, spread: 0, pierce: 5,
    projScale: 1.6, speed: 34, color: 0xffd23f, sound: "cannon", energyCost: 16,
    style: "saw", desc: "Säge durchschlägt viele Bugs",
  },
  needler: {
    id: "needler", name: "Bit-Needler", icon: "📌",
    fireInterval: 0.06, damage: 1, projCount: 1, spread: 0.1, pierce: 0,
    projScale: 0.5, speed: 82, color: 0x80ed99, sound: "minigun", energyCost: 4.4,
    style: "star", desc: "Schnelle Präzisionsnadeln",
  },
  arc: {
    id: "arc", name: "Lightning-Arc", icon: "⚡️",
    fireInterval: 0.09, damage: 1, projCount: 2, spread: 0.08, pierce: 1,
    projScale: 0.8, speed: 90, color: 0x6ef0ff, sound: "smg", energyCost: 7.5,
    style: "tracer", desc: "Schnelle Doppel-Blitze, durchschlagend",
  },
  photon: {
    id: "photon", name: "Photon-Beam", icon: "🔆",
    fireInterval: 0.7, damage: 4, projCount: 1, spread: 0, pierce: 6,
    projScale: 1.2, speed: 150, color: 0xfff3b0, sound: "sniper", energyCost: 30,
    style: "laser", desc: "Hyperschneller Strahl, durchschlägt alles",
  },
  voidlober: {
    id: "voidlober", name: "Void-Lober", icon: "🕳️",
    fireInterval: 1.1, damage: 3, projCount: 1, spread: 0, pierce: 4,
    projScale: 2.0, speed: 32, color: 0x9b5de5, sound: "cannon", energyCost: 34,
    style: "plasma", desc: "Riesige, langsame Singularität",
  },
  recursion: {
    id: "recursion", name: "Recursion-Disc", icon: "♻️",
    fireInterval: 0.45, damage: 2, projCount: 2, spread: 0.5, pierce: 7,
    projScale: 1.5, speed: 38, color: 0x80ed99, sound: "cannon", energyCost: 18,
    style: "saw", desc: "Zwei Sägen, durchschlagen viele Bugs",
  },
  nova: {
    id: "nova", name: "Supernova-Scatter", icon: "✴️",
    fireInterval: 0.62, damage: 2, projCount: 12, spread: 1.5, pierce: 2,
    projScale: 0.85, speed: 62, color: 0xff8c1a, sound: "shotgun", energyCost: 24,
    style: "star", desc: "Rundumschlag: 12 durchschlagende Sterne",
  },
  glitch: {
    id: "glitch", name: "Glitch-Cannon", icon: "👾",
    fireInterval: 0.5, damage: 2, projCount: 3, spread: 0.3, pierce: 2,
    projScale: 1.1, speed: 60, color: 0xff6ec7, sound: "pulse", energyCost: 20,
    style: "ball", desc: "Dreifacher Glitch-Schub",
  },

  // ====================================================================
  //  KREATIVE WAFFEN — jede hat ein eigenes, eigenwilliges Verhalten.
  // ====================================================================

  // 🪃 Fliegt raus und kommt als Bumerang zurück – trifft auf beiden Wegen.
  boomerang: {
    id: "boomerang", name: "Garbage-Collector", icon: "🪃",
    fireInterval: 0.72, damage: 2, projCount: 1, spread: 0, pierce: 50,
    projScale: 1.25, speed: 48, color: 0x80ed99, sound: "cannon", energyCost: 18,
    style: "saw", desc: "Sammelt ein & kommt zurück (trifft hin & zurück)",
    behavior: "boomerang", outTime: 0.46, projLife: 2.2,
  },

  // 🚀 Zielsuchende Rakete, die beim Einschlag explodiert.
  rocket: {
    id: "rocket", name: "Heap-Seeker", icon: "🚀",
    fireInterval: 0.85, damage: 3, projCount: 1, spread: 0.05, pierce: 0,
    projScale: 1.1, speed: 48, color: 0xff8c1a, sound: "cannon", energyCost: 28,
    style: "tracer", desc: "Zielsuchend, explodiert beim Treffer",
    behavior: "homing", homingRate: 4.6, explodeR: 4.5, explodeDmg: 2, projLife: 2.4,
  },

  // 💣 Bogenwurf-Granate – schlägt am Boden ein und detoniert großflächig.
  grenade: {
    id: "grenade", name: "Stack-Smash", icon: "💣",
    fireInterval: 0.98, damage: 2, projCount: 1, spread: 0.04, pierce: 0,
    projScale: 1.4, speed: 26, color: 0xffd23f, sound: "cannon", energyCost: 30,
    style: "plasma", desc: "Bogenwurf, riesige Boden-Explosion",
    behavior: "lob", lobVy: 11, explodeR: 6, explodeDmg: 4, projLife: 2.5,
  },

  // 🏓 Prallt von den Arena-Wänden ab und richtet Chaos an.
  ricochet: {
    id: "ricochet", name: "Pong-Cannon", icon: "🏓",
    fireInterval: 0.4, damage: 2, projCount: 1, spread: 0.08, pierce: 1,
    projScale: 1.0, speed: 72, color: 0x6ee7ff, sound: "blaster", energyCost: 13,
    style: "ball", desc: "Prallt von Wänden ab – unberechenbar",
    behavior: "bounce", bounces: 4, projLife: 2.6,
  },

  // 🕳️ Langsame Singularität: saugt Bugs an und implodiert am Ende.
  singularity: {
    id: "singularity", name: "Void-Singularity", icon: "🕳️",
    fireInterval: 1.35, damage: 1, projCount: 1, spread: 0, pierce: 50,
    projScale: 2.0, speed: 22, color: 0x9b5de5, sound: "pulse", energyCost: 38,
    style: "plasma", desc: "Saugt Bugs an, implodiert mit Wucht",
    behavior: "blackhole", pullR: 8, pullForce: 9, explodeR: 7, explodeDmg: 5, projLife: 1.7,
  },

  // ⚡ Kettenblitz: springt vom Treffer zu nahen Bugs weiter.
  tesla: {
    id: "tesla", name: "Daisy-Chain", icon: "⚡",
    fireInterval: 0.5, damage: 2, projCount: 1, spread: 0.06, pierce: 0,
    projScale: 0.9, speed: 95, color: 0x6ef0ff, sound: "smg", energyCost: 20,
    style: "tracer", desc: "Blitz springt zu weiteren Bugs",
    behavior: null, chainN: 4, chainRange: 9,
  },

  // 🛰️ Drohnen kreisen um die Ente und mähen alles im Umkreis nieder.
  swarm: {
    id: "swarm", name: "Drone-Swarm", icon: "🛰️",
    fireInterval: 0.55, damage: 2, projCount: 4, spread: 0, pierce: 50,
    projScale: 0.85, speed: 0, color: 0x6ee7ff, sound: "needler", energyCost: 16,
    style: "star", desc: "4 Drohnen kreisen & schützen dich",
    behavior: "orbit", orbitR: 4.6, orbitSpin: 3.6, projLife: 1.5,
  },

  // 〰️ Schlängel-Schüsse, die in Sinuswellen tanzen.
  wobble: {
    id: "wobble", name: "DubStep-Cannon", icon: "〰️",
    fireInterval: 0.16, damage: 1, projCount: 1, spread: 0, pierce: 1,
    projScale: 0.95, speed: 58, color: 0xff6ec7, sound: "blaster", energyCost: 7,
    style: "ball", desc: "Tanzt in Wellen – deckt Breite ab",
    behavior: "wave", waveAmp: 1.7, waveFreq: 11, projLife: 1.4,
  },

  // 🔥 Kurzer Flammenkegel – grillt alles in Nahdistanz.
  flame: {
    id: "flame", name: "Heap-Flame", icon: "🔥",
    fireInterval: 0.05, damage: 1, projCount: 3, spread: 0.34, pierce: 2,
    projScale: 0.9, speed: 34, color: 0xff8c1a, sound: "minigun", energyCost: 5.5,
    style: "pellet", desc: "Flammenkegel auf kurze Distanz",
    behavior: null, projLife: 0.42,
  },

  // 🍴 Geschoss zerplatzt beim ersten Treffer in fünf Splitter.
  forkbomb: {
    id: "forkbomb", name: "Fork-Bomb", icon: "🍴",
    fireInterval: 0.62, damage: 3, projCount: 1, spread: 0.05, pierce: 0,
    projScale: 1.1, speed: 56, color: 0x80ed99, sound: "pulse", energyCost: 18,
    style: "ball", desc: "Zerplatzt in 5 Splitter beim Treffer",
    behavior: null, splitN: 5,
  },
};

// Preise für den Waffenshop (Armory). Run-Coins.
// Tiers: günstige Einstiegswaffen ~70-90, Mittelklasse ~110-150,
// Spitzenwaffen 170-230. Starke Dauerfeuer-/Pierce-Waffen kosten jetzt
// deutlich mehr → man muss auf sie hinsparen.
export const WEAPON_PRICE = {
  // günstig
  shotgun: 70, trishot: 80, smg: 95, needler: 95,
  // Mittelklasse
  flak: 110, cannon: 120, pulse: 120, sawblade: 130, minigun: 140, arc: 150,
  // Spitze
  glitch: 160, nova: 160, railgun: 180, recursion: 190, voidlober: 200, sniper: 210, photon: 230,
  // kreative Waffen (nach Verhalten/Stärke eingeordnet)
  wobble: 110, ricochet: 130, flame: 130, swarm: 145, tesla: 150, forkbomb: 150,
  boomerang: 135, grenade: 175, rocket: 185, singularity: 230,
};

export const WEAPON_IDS = Object.keys(WEAPONS);
