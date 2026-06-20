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

    window.addEventListener("keydown", (e) => {
      if (e.code in MOVE_KEYS || e.code === "Space") e.preventDefault();
      if (!this.down.has(e.code)) this.justPressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());
  }

  // Bewegungsrichtung als {x, z}, normalisiert (Diagonale nicht schneller).
  moveVector() {
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
}
