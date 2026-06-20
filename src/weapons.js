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
};

export const WEAPON_IDS = Object.keys(WEAPONS);
