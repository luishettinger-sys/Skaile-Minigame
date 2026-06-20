// Power-Ups: zeitlich begrenzte Buffs + sofortige Effekte.
export const POWERUPS = {
  rapid: { icon: "⚡", color: 0xffd23f, dur: 7, label: "Schnellfeuer" },
  double: { icon: "💢", color: 0xff5470, dur: 7, label: "Doppelschaden" },
  shield: { icon: "🛡️", color: 0x6ee7ff, dur: 5, label: "Schild" },
  slow: { icon: "🧊", color: 0x9bb0ff, dur: 5, label: "Zeitlupe" },
  nuke: { icon: "💥", color: 0xff8c1a, instant: true, label: "Purge" },
  heal: { icon: "❤️", color: 0x80ed99, instant: true, label: "Heilung" },
};

export const POWER_IDS = Object.keys(POWERUPS);
export const TIMED_IDS = POWER_IDS.filter((id) => !POWERUPS[id].instant);
