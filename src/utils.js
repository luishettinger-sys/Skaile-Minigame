// Kleine, wiederverwendbare Mathe-/Helfer-Funktionen.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const lerp = (a, b, t) => a + (b - a) * t;

// Framerate-unabhängiges Glätten (statt naivem lerp mit fixem t).
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const randRange = (min, max) => min + Math.random() * (max - min);

export const randInt = (min, max) => Math.floor(randRange(min, max + 1));

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Gewichtete Zufallsauswahl: entries = [{ value, weight }, ...]
export function pickWeighted(entries) {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

// 2D-Distanz auf der XZ-Ebene (Boden).
export const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Winkel weich annähern (kürzester Weg, framerate-unabhängig).
export function angleLerp(cur, target, lambda, dt) {
  let d = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return cur + d * (1 - Math.exp(-lambda * dt));
}
