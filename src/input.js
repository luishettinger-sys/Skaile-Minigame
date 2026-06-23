// Tastatur-Eingabe. Liefert einen normalisierten Bewegungsvektor (XZ)
// und einen "justPressed"-Puffer für einmalige Aktionen (z.B. Ultimate).

const MOVE_KEYS = {
  KeyW: "up", ArrowUp: "up",
  KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
};

export class Input {
  constructor() {
    this.down = new Set();
    this.justPressed = new Set();
    this.mouse = { ndcX: 0, ndcY: 0 }; // normalisierte Bildschirmkoordinaten (-1..1)
    this.mouseDown = false; // linke Maustaste gehalten (= schießen)
    this.touch = { x: 0, z: 0 }; // virtueller Joystick (Mobile)
    this.touchFire = false;       // Angriff-Button gehalten (Mobile)

    window.addEventListener("keydown", (e) => {
      if (e.code in MOVE_KEYS || e.code === "Space" || e.code === "Tab") {
        e.preventDefault();
      }
      if (!this.down.has(e.code)) this.justPressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => {
      this.down.clear();
      this.mouseDown = false;
    });

    window.addEventListener("mousemove", (e) => {
      this.mouse.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
    });

    this._initTouch(); // Mobile: Joystick + Buttons (nur auf Touch-Geräten)
  }

  // Bewegungsrichtung als {x, z}, normalisiert (Diagonale nicht schneller).
  moveVector() {
    // Touch-Joystick hat Vorrang (analog), sonst Tastatur (normalisiert).
    if (this.touch && (this.touch.x || this.touch.z)) return { x: this.touch.x, z: this.touch.z };
    let x = 0, z = 0;
    for (const code of this.down) {
      const dir = MOVE_KEYS[code];
      if (dir === "up") z -= 1;
      else if (dir === "down") z += 1;
      else if (dir === "left") x -= 1;
      else if (dir === "right") x += 1;
    }
    const len = Math.hypot(x, z);
    if (len > 0) { x /= len; z /= len; }
    return { x, z };
  }

  wasPressed(code) {
    return this.justPressed.has(code);
  }

  isDown(code) {
    return this.down.has(code);
  }

  // Am Ende jedes Frames aufrufen, um den Einmal-Puffer zu leeren.
  endFrame() {
    this.justPressed.clear();
  }

  // Mobile-Steuerung: virtueller Joystick (links, Bewegung) + Angriff-Button
  // (rechts, halten) + kleine Aktions-Buttons (Dash, E, Ultimate). Nur auf Touch.
  _initTouch() {
    const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    document.body.classList.add("is-touch");
    const el = (cls, txt) => { const d = document.createElement("div"); d.className = cls; if (txt) d.textContent = txt; return d; };

    // --- Joystick (links) ---
    const base = el("tjoy"); const knob = el("tjoy-knob"); base.appendChild(knob);
    document.body.appendChild(base);
    let jid = null, cx = 0, cy = 0; const R = 56;
    const setKnob = (dx, dy) => {
      const l = Math.hypot(dx, dy) || 1; const c = Math.min(1, l / R);
      knob.style.transform = `translate(${(dx / l) * c * R}px, ${(dy / l) * c * R}px)`;
      this.touch.x = (dx / l) * c; this.touch.z = (dy / l) * c;
    };
    base.addEventListener("touchstart", (e) => {
      e.preventDefault(); const t = e.changedTouches[0]; jid = t.identifier;
      const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      setKnob(t.clientX - cx, t.clientY - cy);
    }, { passive: false });
    window.addEventListener("touchmove", (e) => {
      if (jid === null) return;
      for (const t of e.changedTouches) if (t.identifier === jid) { setKnob(t.clientX - cx, t.clientY - cy); e.preventDefault(); }
    }, { passive: false });
    const endJoy = (e) => {
      if (jid === null) return;
      for (const t of e.changedTouches) if (t.identifier === jid) { jid = null; this.touch.x = 0; this.touch.z = 0; knob.style.transform = "translate(0,0)"; }
    };
    window.addEventListener("touchend", endJoy); window.addEventListener("touchcancel", endJoy);

    // --- Angriff (rechts, halten = Dauerangriff; Zielen ist automatisch) ---
    const atk = el("tbtn tbtn-attack", "⚔️"); document.body.appendChild(atk);
    atk.addEventListener("touchstart", (e) => { e.preventDefault(); this.touchFire = true; atk.classList.add("on"); }, { passive: false });
    const atkUp = (e) => { e.preventDefault(); this.touchFire = false; atk.classList.remove("on"); };
    atk.addEventListener("touchend", atkUp); atk.addEventListener("touchcancel", atkUp);

    // --- Aktions-Buttons: Dash, E (Tor/Markt), Ultimate ---
    const mk = (cls, label, code) => {
      const btn = el("tbtn " + cls, label); document.body.appendChild(btn);
      btn.addEventListener("touchstart", (e) => { e.preventDefault(); if (!this.down.has(code)) this.justPressed.add(code); this.down.add(code); btn.classList.add("on"); }, { passive: false });
      const up = (e) => { e.preventDefault(); this.down.delete(code); btn.classList.remove("on"); };
      btn.addEventListener("touchend", up); btn.addEventListener("touchcancel", up);
    };
    mk("tbtn-dash", "💨", "ShiftLeft");
    mk("tbtn-e", "E", "KeyE");
    mk("tbtn-q", "🦆", "KeyR");
  }
}
