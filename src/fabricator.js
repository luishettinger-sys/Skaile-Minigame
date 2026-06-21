// Fabrikator (West-Raum): ein 3D-Drucker, der aus Schrott (🔩) über Zeit
// Verbrauchsgüter druckt. Job starten → weiterkämpfen → ist er fertig, landet das
// Modul automatisch in deinem Gürtel (Tasten [1]–[4] zünden es im Kampf).
//
// Item: { name, icon, cost (🔩), time (Sek Druckzeit), slot (1–4), desc }

export const FAB_ITEMS = {
  heal:   { name: "Heil-Pack",    icon: "🩹", cost: 8,  time: 10, slot: 1, desc: "Stellt 40 HP her" },
  shield: { name: "Schild-Modul", icon: "🛡️", cost: 12, time: 16, slot: 2, desc: "5 s unverwundbar" },
  cool:   { name: "Kühl-Spray",   icon: "❄️", cost: 6,  time: 8,  slot: 3, desc: "CPU sofort auf 0°" },
  purge:  { name: "Purge-Bombe",  icon: "💥", cost: 18, time: 22, slot: 4, desc: "Löscht alle Bugs" },
};

export const FAB_ORDER = ["heal", "shield", "cool", "purge"];

// id für einen Belt-Slot (1–4).
export function fabBySlot(slot) {
  return FAB_ORDER.find((id) => FAB_ITEMS[id].slot === slot) || null;
}
