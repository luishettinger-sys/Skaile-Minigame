// Rubber-Duck-Guide: eine Mentor-Ente führt neue Spieler:innen per Sprechblasen
// Schritt für Schritt durch die Kern-Schleife (Deploy → Coins → Räume freischalten).
// Jeder Schritt wartet auf ein bestimmtes Spiel-Ereignis (`on`) und schaltet dann
// zum nächsten weiter. Passt zum Rubber-Duck-Debugging-Thema.

const STEPS = [
  { on: "move",        text: "Hi! Ich bin deine Kampf-Ente 🦆 – beweg dich mit WASD oder den Pfeiltasten." },
  { on: "waveCleared", text: "Stark! ✅ Die Bugs wollen den PC fressen – halt sie auf. Fürs Abwehren gibt's 🪙 Coins zum Aufrüsten." },
  { on: null,          text: "Beschütze den PC, überlebe die Wellen, werde stärker. Viel Spaß, Boss! 🦆", hold: 8 },
];

export class Guide {
  constructor(hud) {
    this.hud = hud;
    this.i = -1;
    this.active = false;
    this.onFinish = null;
    this._hideTimer = null;
  }

  // Startet die Tour von vorn (nur wenn gewünscht, z.B. beim ersten Run).
  start(onFinish) {
    this.onFinish = onFinish || null;
    this.i = 0;
    this.active = true;
    this._show();
  }

  stop() {
    this.active = false;
    this.hud.hideGuide();
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
  }

  // Ein Spiel-Ereignis melden; passt es zum aktuellen Schritt → weiterschalten.
  event(name) {
    if (!this.active) return;
    const step = STEPS[this.i];
    if (step && step.on === name) this._advance();
  }

  _advance() {
    this.i++;
    if (this.i >= STEPS.length) { this._finish(); return; }
    this._show();
  }

  _show() {
    const step = STEPS[this.i];
    if (!step) return;
    this.hud.showGuide(step.text);
    // Terminaler Schritt (on === null): nach `hold` Sekunden ausblenden + fertig.
    if (step.on === null) {
      const ms = (step.hold || 6) * 1000;
      this._hideTimer = setTimeout(() => this._finish(), ms);
    }
  }

  _finish() {
    this.active = false;
    this.hud.hideGuide();
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this.onFinish) this.onFinish();
  }
}
