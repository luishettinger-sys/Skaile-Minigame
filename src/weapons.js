// Waffen-Arsenal. Jede Waffe definiert Basiswerte; Upgrades (mods) modifizieren
// sie zusätzlich. Geschoss-Optik (Farbe/Größe/Speed) und Sound pro Waffe.
export const WEAPONS = {
  blaster: {
    id: "blaster", name: "Quack-Blaster", icon: "🔫",
    fireInterval: 0.15, damage: 1, projCount: 1, spread: 0.10, pierce: 0,
    projScale: 1.0, speed: 54, color: 0xfff3b0, sound: "blaster",
    desc: "Solider Allrounder",
  },
  shotgun: {
    id: "shotgun", name: "Bread-Shotgun", icon: "💥",
    fireInterval: 0.6, damage: 1, projCount: 6, spread: 0.32, pierce: 0,
    projScale: 0.9, speed: 46, color: 0xff8c1a, sound: "shotgun",
    desc: "6 Kugeln, breite Streuung",
  },
  smg: {
    id: "smg", name: "Stack-SMG", icon: "⚡",
    fireInterval: 0.07, damage: 1, projCount: 1, spread: 0.17, pierce: 0,
    projScale: 0.7, speed: 66, color: 0x6ee7ff, sound: "smg",
    desc: "Sehr schnell, etwas streuend",
  },
  railgun: {
    id: "railgun", name: "Nullpointer-Rail", icon: "🎯",
    fireInterval: 0.72, damage: 4, projCount: 1, spread: 0, pierce: 6,
    projScale: 1.1, speed: 98, color: 0xff6ec7, sound: "rail",
    desc: "Durchschlägt alles, hoher Schaden",
  },
  cannon: {
    id: "cannon", name: "Heap-Kanone", icon: "🟢",
    fireInterval: 0.95, damage: 3, projCount: 1, spread: 0, pierce: 1,
    projScale: 1.9, speed: 40, color: 0x80ed99, sound: "cannon",
    desc: "Dicke, langsame Brocken",
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);
