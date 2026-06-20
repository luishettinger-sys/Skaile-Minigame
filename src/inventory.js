// Inventar + Ausrüstung. Taschen-Items lassen sich in Slots ausrüsten;
// ausgerüstete Items liefern kombinierte Stat-Boni (mods).
import { defaultMods, mergeMods } from "./items.js";

const SLOTS = 6;

export class Inventory {
  constructor() {
    this.reset();
  }

  reset() {
    this.items = []; // Tasche (nicht ausgerüstet)
    this.slots = new Array(SLOTS).fill(null); // Ausrüstungs-Slots
  }

  get slotCount() {
    return SLOTS;
  }

  add(item) {
    this.items.push(item);
  }

  // Item aus der Tasche in den nächsten freien Slot ausrüsten.
  equip(itemIndex) {
    const item = this.items[itemIndex];
    if (!item) return false;
    const free = this.slots.indexOf(null);
    if (free < 0) return false; // alle Slots belegt
    this.slots[free] = item;
    this.items.splice(itemIndex, 1);
    return true;
  }

  // Item aus einem Slot zurück in die Tasche.
  unequip(slotIndex) {
    const item = this.slots[slotIndex];
    if (!item) return false;
    this.slots[slotIndex] = null;
    this.items.push(item);
    return true;
  }

  sort() {
    this.items.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Kombinierte Boni aller ausgerüsteten Items.
  computeMods() {
    const m = defaultMods();
    for (const it of this.slots) if (it) mergeMods(m, it.mods);
    return m;
  }
}
