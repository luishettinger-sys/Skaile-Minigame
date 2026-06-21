// Roguelite-Tiefe: Sektor-Anomalien + Run-Start-Draft.
//
// SEKTOR-ANOMALIEN: Jeder Sektor (alle 5 Wellen) bekommt einen Modifikator, der
// den Run verändert → jeder Durchlauf fühlt sich anders an. Wirken nur über
// Spieler-Mods / Loot / Hitze (keine riskanten Gegner-Eingriffe) → sicher.
//   mods         -> Spieler-Mods (in die Mod-Kette)
//   lootMult     -> Schrott/Daten-Drop ×N
//   coinMult     -> Coins von Bugs ×N
//   heatGainMult -> CPU heizt schneller/langsamer
//   heatCoolMult -> CPU kühlt schneller/langsamer

export const SECTOR_MODS = {
  goldrush: {
    icon: "💰", name: "Daten-Goldrausch", desc: "+100 % Schrott & Daten in diesem Sektor",
    lootMult: 2,
  },
  overclocked: {
    icon: "⚡", name: "Übertaktet", desc: "+40 % Feuerrate – aber die CPU heizt 50 % schneller",
    mods: { fireMult: 0.6 }, heatGainMult: 1.5,
  },
  burning: {
    icon: "🔥", name: "Brennende Platine", desc: "+35 % Schaden – aber die CPU heizt schneller",
    mods: { dmgMult: 1.35 }, heatGainMult: 1.3,
  },
  cooled: {
    icon: "❄️", name: "Notkühlung aktiv", desc: "CPU kühlt doppelt so schnell – dafür −12 % Schaden",
    mods: { dmgMult: 0.88 }, heatCoolMult: 2,
  },
  critstorm: {
    icon: "💥", name: "Krit-Sturm", desc: "+18 % Krit-Chance & +20 % Projektil-Tempo",
    mods: { critAdd: 0.18, projSpeedMult: 1.2 },
  },
  magnet: {
    icon: "🧲", name: "Magnet-Sturm", desc: "+120 % Sammelradius & +40 % Coins",
    mods: { magnetMult: 2.2 }, coinMult: 1.4,
  },
  glass: {
    icon: "💎", name: "Glas-Sektor", desc: "+55 % Schaden – aber nur halbe max. HP",
    mods: { dmgMult: 1.55, maxHpAdd: -30 },
  },
  fortress: {
    icon: "🛡️", name: "Bollwerk-Sektor", desc: "+50 max HP & +2 HP/Sek Regeneration",
    mods: { maxHpAdd: 50, regen: 2 },
  },
};

export const SECTOR_MOD_IDS = Object.keys(SECTOR_MODS);

// Anomalie für einen Sektor ziehen (nicht dieselbe wie zuletzt).
export function rollSectorMod(exclude = null) {
  const pool = SECTOR_MOD_IDS.filter((id) => id !== exclude);
  const id = pool[Math.floor(Math.random() * pool.length)];
  return { id, ...SECTOR_MODS[id] };
}

// RUN-START-DRAFT: Wähle 1 von 3 Start-Builds (Startwaffe + Perk-Mods). Setzt den
// Grundcharakter des Runs. weapon = Waffen-ID, mods = Start-Boni.
export const DRAFTS = {
  gunner: {
    icon: "🔫", name: "Dauerfeuer", weapon: "smg", desc: "SMG · +12 % Feuerrate",
    mods: { fireMult: 0.88 },
  },
  sniper: {
    icon: "🎯", name: "Scharfschütze", weapon: "sniper", desc: "Sniper · +12 % Krit, +1 Durchschlag",
    mods: { critAdd: 0.12, pierceAdd: 1 },
  },
  bruiser: {
    icon: "💥", name: "Schwergewicht", weapon: "shotgun", desc: "Schrotflinte · +20 % Schaden, +20 max HP",
    mods: { dmgMult: 1.2, maxHpAdd: 20 },
  },
  swarmer: {
    icon: "🔱", name: "Schwarm", weapon: "trishot", desc: "Tri-Shot · +1 Geschoss",
    mods: { projAdd: 1 },
  },
  tank: {
    icon: "🛡️", name: "Panzer", weapon: "minigun", desc: "Minigun · +35 max HP, +1 HP/Sek",
    mods: { maxHpAdd: 35, regen: 1 },
  },
};

export const DRAFT_IDS = Object.keys(DRAFTS);

export function rollDrafts(n = 3) {
  const pool = [...DRAFT_IDS];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    out.push({ id, ...DRAFTS[id] });
  }
  return out;
}
