// Chip-Sockel (Nord-Raum): ein 3×3-Mainboard-Raster, in das du gesammelte Chips
// (🧩, droppen aus Bugs) steckst. Jeder Chip gibt einen passiven Bonus – UND
// gleiche Chips, die orthogonal benachbart liegen, verstärken sich gegenseitig
// (+50 % je Nachbar). Das macht die ANORDNUNG zum Tüftel-Spiel, nicht den Kauf.
//
// Chip: { id, name, icon, color, cost, delta?, flag? }
//   delta -> Stat-Beiträge (Mult-Keys werden zu 1+Summe, Rest addiert)
//   flag  -> Sonder-Effekt (heatCool: extra CPU-Abkühlung/Sek)

export const CHIP_TYPES = {
  cpu:  { name: "CPU-Kern",  icon: "🧠", color: 0xff5470, cost: 2, delta: { dmgMult: 0.12 } },
  ram:  { name: "RAM-Riegel", icon: "🟩", color: 0x80ed99, cost: 2, delta: { fireMult: -0.08 } },
  ssd:  { name: "SSD-Cache", icon: "💾", color: 0x6ee7ff, cost: 2, delta: { moveSpeedMult: 0.1 } },
  gpu:  { name: "GPU-Kern",  icon: "🟥", color: 0xffa040, cost: 2, delta: { critAdd: 0.06 } },
  cool: { name: "Heatsink",  icon: "❄️", color: 0x9bd0ff, cost: 2, flag: { heatCool: 9 } },
  mag:  { name: "Coil-Magnet", icon: "🧲", color: 0xc792ea, cost: 2, delta: { magnetMult: 0.3 } },
  fw:   { name: "Firewall",  icon: "🛡️", color: 0xffd23f, cost: 3, delta: { maxHpAdd: 18 } },
};

export const CHIP_ORDER = ["cpu", "ram", "ssd", "gpu", "cool", "mag", "fw"];

export const GRID_N = 3; // 3×3-Raster

// Anzahl orthogonaler Nachbarn desselben Typs (für Adjazenz-Bonus).
export function sameNeighbors(grid, idx) {
  const r = Math.floor(idx / GRID_N), c = idx % GRID_N;
  const id = grid[idx];
  if (!id) return 0;
  let n = 0;
  const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
  for (const [rr, cc] of nb) {
    if (rr < 0 || cc < 0 || rr >= GRID_N || cc >= GRID_N) continue;
    if (grid[rr * GRID_N + cc] === id) n++;
  }
  return n;
}

// Effekt-Stärke eines Slots = 1 + 0.5 je gleichem Nachbarn.
export function slotStrength(grid, idx) {
  return 1 + 0.5 * sameNeighbors(grid, idx);
}

// Aggregierte Stat-Mods aus dem Raster (für die Mod-Kette).
export function chipMods(grid) {
  const adds = {};
  for (let i = 0; i < grid.length; i++) {
    const id = grid[i];
    const t = CHIP_TYPES[id];
    if (!t || !t.delta) continue;
    const s = slotStrength(grid, i);
    for (const k in t.delta) adds[k] = (adds[k] || 0) + t.delta[k] * s;
  }
  const out = {};
  for (const k in adds) out[k] = k.endsWith("Mult") ? 1 + adds[k] : adds[k];
  return out;
}

// Sonder-Flags (z.B. zusätzliche CPU-Abkühlung durch Heatsinks).
export function chipFlags(grid) {
  let heatCool = 0;
  for (let i = 0; i < grid.length; i++) {
    const t = CHIP_TYPES[grid[i]];
    if (t?.flag?.heatCool) heatCool += t.flag.heatCool * slotStrength(grid, i);
  }
  return { heatCool };
}

// Raster auf feste Länge bringen (9 Slots, leere = null).
export function normalizeGrid(grid) {
  const out = new Array(GRID_N * GRID_N).fill(null);
  if (Array.isArray(grid)) for (let i = 0; i < out.length; i++) if (CHIP_TYPES[grid[i]]) out[i] = grid[i];
  return out;
}
