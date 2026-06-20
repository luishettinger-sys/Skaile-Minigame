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
    projScale: 0.7, speed: 66, color: 0x6ee7ff, sound: "smg", energyCost: 3.2,
    style: "tracer", desc: "Sehr schnell, etwas streuend",
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
    projScale: 0.65, speed: 72, color: 0xffd23f, sound: "minigun", energyCost: 2.4,
    style: "tracer", desc: "Extrem schnell, streut stark",
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
    fireInterval: 0.7, damage: 1, projCount: 8, spread: 0.5, pierce: 0,
    projScale: 0.8, speed: 44, color: 0xff5470, sound: "shotgun", energyCost: 30,
    style: "pellet", desc: "8 Splitter, sehr breit",
  },
  pulse: {
    id: "pulse", name: "Async-Pulswelle", icon: "🟣",
    fireInterval: 0.5, damage: 2, projCount: 1, spread: 0, pierce: 3,
    projScale: 1.4, speed: 50, color: 0xc8a2ff, sound: "pulse", energyCost: 18,
    style: "plasma", desc: "Durchschlagende Pulskugel",
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);
