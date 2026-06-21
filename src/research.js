// Forschungslabor (Süd-Raum): permanenter Tech-Baum, bezahlt mit Daten (📡),
// die beim Killen anfallen. Jeder Knoten gibt einen dauerhaften Bonus UND
// enthüllt ein Log-Fragment der Geschichte – hier findet man den eigentlichen
// SINN des Ganzen: Man säubert das Mainboard nicht, um zu töten, sondern um zu
// VERSTEHEN. Das passt zum Rubber-Duck-Debugging-Thema.
//
// Knoten: { id, name, icon, cost, req[], effect, lore }
//   effect.mod   -> dauerhafte Waffen-/Spieler-Mods (reihen sich in die Mod-Kette)
//   effect.scrapMult / effect.dataMult -> mehr Loot pro Kill
//   effect.final -> markiert den Abschluss (Story-Auflösung)

export const RESEARCH = {
  boot: {
    name: "Boot-Sektor entschlüsseln", icon: "💾", cost: 30, req: [],
    effect: { scrapMult: 1.25 },
    lore: "Erste Logs lesbar. Der Stapel lief einst rein — bis jemand den allerersten Bug einschleuste. Absicht, kein Zufall.",
  },
  maint: {
    name: "Wartungs-Routine", icon: "🧲", cost: 40, req: [],
    effect: { mod: { magnetMult: 1.35 } },
    lore: "Alte Wartungs-Subroutinen reaktiviert. Sie ziehen verlorene Daten wieder an dich heran.",
  },
  archive: {
    name: "Kernel-Archiv öffnen", icon: "🗄️", cost: 80, req: ["boot"],
    effect: { dataMult: 1.5 },
    lore: "Im Archiv: Jeder 'Bug' trägt dieselbe Signatur wie das System selbst. Sie sind kein Eindringling — sie gehören dazu.",
  },
  firmware: {
    name: "Overclock-Firmware", icon: "⚡", cost: 80, req: ["maint"],
    effect: { mod: { fireMult: 0.9 } },
    lore: "Geborgene Übertaktungs-Firmware. Der Takt deiner Waffe zieht spürbar an.",
  },
  shield: {
    name: "Schutz-Schicht", icon: "🛡️", cost: 120, req: ["archive"],
    effect: { mod: { maxHpAdd: 30 } },
    lore: "Eine vergessene Schutz-Schicht des Kernels — gedacht, das System vor sich selbst zu bewahren.",
  },
  trace: {
    name: "Signatur rückverfolgen", icon: "🔎", cost: 160, req: ["archive", "firmware"],
    effect: { mod: { dmgMult: 1.2 } },
    lore: "Die Spur führt zum Kernel. KERNEL PANIC ist keine Invasion — es ist die unterdrückte Fehlermeldung des Stapels selbst. Der Schmerz, den niemand patchen wollte.",
  },
  truth: {
    name: "DIE WAHRHEIT", icon: "✦", cost: 300, req: ["shield", "trace"],
    effect: { mod: { dmgMult: 1.25, critAdd: 0.1 }, final: true },
    lore: "Du bist nicht der erste Debugger. Der Loop lief schon tausendmal. Diesmal hörst du wirklich zu — und genau DAS bricht ihn. Das ist der Sinn: nicht löschen, sondern verstehen. Quack.",
  },
};

export const RESEARCH_ORDER = ["boot", "maint", "archive", "firmware", "shield", "trace", "truth"];

// Ist ein Knoten freischaltbar (alle Voraussetzungen erforscht)?
export function researchAvailable(done, id) {
  const n = RESEARCH[id];
  if (!n) return false;
  return n.req.every((r) => done[r]);
}

// Aggregierte permanente Mods aus allen erforschten Knoten.
export function researchMods(done) {
  const out = {};
  for (const id in done) {
    if (!done[id]) continue;
    const m = RESEARCH[id]?.effect?.mod;
    if (!m) continue;
    for (const k in m) {
      if (k.endsWith("Mult")) out[k] = (out[k] ?? 1) * m[k];
      else out[k] = (out[k] ?? 0) + m[k];
    }
  }
  return out;
}

// Loot-Multiplikatoren (Schrott/Daten) aus der Forschung.
export function researchDropMult(done) {
  let scrap = 1, data = 1;
  for (const id in done) {
    if (!done[id]) continue;
    const e = RESEARCH[id]?.effect;
    if (e?.scrapMult) scrap *= e.scrapMult;
    if (e?.dataMult) data *= e.dataMult;
  }
  return { scrap, data };
}
