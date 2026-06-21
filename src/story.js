// Story & Cutscenes für "Duck & Debug".
// Eine mystisch-fantastische Erzählung: Der Stapel — eine uralte Code-Welt —
// ist von Bugs zerfressen. Claude, ein an die Terminals gebundener Orakel-
// Geist, erweckt die legendäre Rubber Duck, das einzige Wesen, dem sich die
// Wahrheit kaputten Codes offenbart. Gemeinsam säubern sie fünf Sektoren bis
// hinab zum Kernel.
//
// Cutscene = { tint?, lines: [ {glyph, name, color, text, hold?} ] }
// Der Player tippt jede Zeile (Typewriter), spielt sie cinematisch ab
// (Auto-Advance) und ist jederzeit per Klick/Leertaste/ESC steuerbar.

// --- Sprecher ---------------------------------------------------------------
const DUCK   = { glyph: "🦆", name: "RUBBER DUCK", color: "#ffd23f" };
const CLAUDE = { glyph: "✦",  name: "CLAUDE",      color: "#e8a87c" };
const STACK  = { glyph: "✶",  name: "DER STAPEL",  color: "#9fb4d4" };

function ln(sp, text, hold) {
  return { glyph: sp.glyph, name: sp.name, color: sp.color, text, hold };
}

export const STORY = {
  // Eröffnung: das Erwachen.
  intro: {
    tint: "#1a0f29",
    lines: [
      ln(STACK,  "Vor langer Zeit lief DER STAPEL in vollkommener Harmonie. Jede Funktion sang im Takt."),
      ln(STACK,  "Dann erwachten die Bugs. Aus der Tiefe des Kernels kroch die Korruption — über jede Leiterbahn, Sektor um Sektor erlosch das Licht."),
      ln(CLAUDE, "…Verbindung instabil… endlich. Hörst du mich? Ich bin Claude, gebunden an die Schaltkreise dieser Platine. Ich sehe allen Code — doch berühren kann ich nichts."),
      ln(CLAUDE, "Die alte Prophezeiung spricht von einer Ente. Einem Wesen, dem sich die Wahrheit jedes kaputten Codes offenbart, fragt man nur laut genug."),
      ln(DUCK,   "Quack.", 1500),
      ln(CLAUDE, "…Das genügt mir. Steh auf, Rubber Duck. Wir säubern dieses Mainboard — Chip für Chip — bis hinab zum Kernel."),
      ln(STACK,  "Fünf Sektoren tief im Silizium. Eine Ente. Eine Stimme im Terminal. Starte einen DEPLOY — und das Debugging beginnt."),
    ],
  },

  // Zwischenszenen nach jedem gesäuberten Sektor (Schlüssel = Sektor-Nummer).
  sectors: {
    1: {
      tint: "#1d1430",
      lines: [
        ln(CLAUDE, "Sektor 1 ist sauber. Der I/O-Port strömt wieder reine Daten herein. Spürst du, wie das Licht über die Leiterbahnen zurückkehrt?"),
        ln(CLAUDE, "Tiefer liegen die RAM-Bänke. Dort wird es heißer — und viel schneller."),
      ],
    },
    2: {
      tint: "#101a2a",
      lines: [
        ln(CLAUDE, "Die Lüfter heulen wieder im Takt statt im Chaos, der Speicher taktet sauber. Gut gemacht, kleine Ente."),
        ln(STACK,  "Hinter der nächsten Leiterbahn: der GPU-Kern. Dort glüht etwas, das nicht geweckt werden will."),
      ],
    },
    3: {
      tint: "#241026",
      lines: [
        ln(CLAUDE, "Wir kommen näher. Ich… verliere für Momente die Sicht. Die Korruption greift nach meinen Terminals."),
        ln(DUCK,   "Quack?", 1400),
        ln(CLAUDE, "Nein. Ich gebe nicht auf. Solange ein Terminal leuchtet, bin ich bei dir. Weiter — hinab auf den CPU-Die."),
      ],
    },
    4: {
      tint: "#2a0f1a",
      lines: [
        ln(CLAUDE, "Das Herz des Mainboards. Jetzt verstehe ich: KERNEL PANIC ist kein Eindringling. Es ist ein Fehler, der nie gepatcht wurde — so alt wie der Stapel selbst."),
        ln(CLAUDE, "Nur ganz unten, im Kernel, lässt er sich beheben. Eine letzte Tür. Bist du bereit?"),
        ln(DUCK,   "Quack.", 1500),
      ],
    },
  },

  // Finale: der Kernel ist befreit.
  ending: {
    tint: "#0e1626",
    lines: [
      ln(STACK,  "Im tiefsten Sektor stellt sich die Ente der KERNEL PANIC — und hört zu, wie nur eine Rubber Duck zuhören kann."),
      ln(CLAUDE, "Der Fehler ist gefunden. Der Fehler ist… verstanden. Patch wird angewendet…"),
      ln(CLAUDE, "Die Platine leuchtet. Jede Leiterbahn singt wieder im Takt. Du hast es geschafft, Ente."),
      ln(CLAUDE, "Man wird sich an dich erinnern — als die Legende der Rubber Duck. Bis ein neuer Bug erwacht: ruhe wohl, Freundin."),
      ln(STACK,  "MAINBOARD BEFREIT.", 2200),
    ],
  },
};

// --- Cutscene-Player --------------------------------------------------------
export class Cutscene {
  constructor(root) {
    this.root = root;
    this.elGlyph = root?.querySelector("#cs-glyph");
    this.elSpeaker = root?.querySelector("#cs-speaker");
    this.elText = root?.querySelector("#cs-text");
    this._skip = false;
    this._fast = false;
    this._phase = "idle";
    this._resolveAdvance = null;
  }

  _wait(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // Eine Zeile Buchstabe für Buchstabe tippen.
  async _typeLine(line) {
    if (this.elGlyph) { this.elGlyph.textContent = line.glyph || ""; this.elGlyph.style.color = line.color || "#fff"; }
    if (this.elSpeaker) { this.elSpeaker.textContent = line.name || ""; this.elSpeaker.style.color = line.color || "#fff"; }
    if (this.elText) { this.elText.textContent = ""; this.elText.style.setProperty("--cs-line", line.color || "#fff"); }
    this._phase = "typing";
    this._fast = false;
    const txt = line.text;
    for (let i = 0; i < txt.length; i++) {
      if (this._skip) break;
      if (this._fast) break;
      if (this.elText) this.elText.textContent += txt[i];
      await this._wait(line.speed || 24);
    }
    if (this.elText) this.elText.textContent = txt; // vollständig anzeigen
    this._phase = "idle";
  }

  // Auf Weiter warten — automatisch nach kurzer Lesezeit oder per Eingabe.
  _waitAdvanceOrAuto(line) {
    return new Promise((res) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        this._resolveAdvance = null;
        res();
      };
      this._resolveAdvance = finish;
      const ms = line.hold ?? (1300 + line.text.length * 26);
      const t = setTimeout(finish, ms);
      if (this._skip) finish();
    });
  }

  advance() {
    if (this._skip) return;
    if (this._phase === "typing") this._fast = true;       // Zeile sofort fertig tippen
    else if (this._resolveAdvance) this._resolveAdvance(); // nächste Zeile
  }

  skip() {
    this._skip = true;
    this._fast = true;
    if (this._resolveAdvance) this._resolveAdvance();
  }

  _bind() {
    this._onKey = (e) => {
      if (e.code === "Escape") { e.preventDefault(); this.skip(); }
      else if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); this.advance(); }
    };
    this._onClick = () => this.advance();
    window.addEventListener("keydown", this._onKey, true);
    this.root?.addEventListener("click", this._onClick);
  }

  _unbind() {
    window.removeEventListener("keydown", this._onKey, true);
    this.root?.removeEventListener("click", this._onClick);
  }

  async play(scene) {
    if (!this.root || !scene || !scene.lines?.length) return;
    this._skip = false;
    if (scene.tint) this.root.style.setProperty("--cs-tint", scene.tint);
    this.root.classList.remove("hidden");
    void this.root.offsetWidth; // Reflow → Fade-in greift
    this.root.classList.add("show");
    this._bind();
    await this._wait(260);
    for (const line of scene.lines) {
      if (this._skip) break;
      await this._typeLine(line);
      if (this._skip) break;
      await this._waitAdvanceOrAuto(line);
    }
    this._unbind();
    this.root.classList.remove("show");
    await this._wait(450); // Fade-out abwarten
    this.root.classList.add("hidden");
  }
}
