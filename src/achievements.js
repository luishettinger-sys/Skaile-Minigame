// Achievements (persistiert in localStorage). Witzige Dev-Meilensteine.
const KEY = "duckdebug_achievements";

export const ACHIEVEMENTS = [
  { id: "first", icon: "🐛", name: "Hello World", desc: "Ersten Bug gefixt", test: (s) => s.kills >= 1 },
  { id: "k100", icon: "🎯", name: "Bug Hunter", desc: "100 Bugs gekillt", test: (s) => s.kills >= 100 },
  { id: "k404", icon: "🚫", name: "404 Not Found", desc: "404 Bugs gekillt", test: (s) => s.kills >= 404 },
  { id: "boss1", icon: "☠️", name: "Kernel Restored", desc: "Ersten Boss besiegt", test: (s) => s.bossKills >= 1 },
  { id: "wave5", icon: "📦", name: "Still Compiling", desc: "Welle 5 erreicht", test: (s) => s.wave >= 5 },
  { id: "wave10", icon: "🚀", name: "Production Ready", desc: "Welle 10 erreicht", test: (s) => s.wave >= 10 },
  { id: "combo", icon: "🔥", name: "Stack Overflowed", desc: "20er-Combo erreicht", test: (s) => s.maxCombo >= 20 },
  { id: "bonus", icon: "💰", name: "Lucky Catch", desc: "Bonus-Bug erwischt", test: (s) => s.bonus >= 1 },
];

export class Achievements {
  constructor() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { /* ignore */ }
    this.unlocked = new Set(saved);
  }

  // Prüft Stats, gibt neu freigeschaltete Achievements zurück.
  check(stats) {
    const out = [];
    for (const a of ACHIEVEMENTS) {
      if (!this.unlocked.has(a.id) && a.test(stats)) {
        this.unlocked.add(a.id);
        out.push(a);
      }
    }
    if (out.length) localStorage.setItem(KEY, JSON.stringify([...this.unlocked]));
    return out;
  }
}
