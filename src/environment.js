// Office-Kulisse: der Schreibtisch rund um die Arena (Monitor, Tastatur,
// Kaffeetasse, Pflanze, Stifthalter). Prozedural, aber stimmungsvoll.
// AI-Texturen (Higgsfield) werden bei Verfügbarkeit nachgeladen.
import * as THREE from "three";
import { CONFIG } from "./config.js";

export function buildOffice(scene) {
  const group = new THREE.Group();

  // Großer Build-Monitor als Feature-Wand im Shop-Raum (Norden, z≈-45).
  // Auch Ziel des Boss-Intros ("der Bug springt aus dem Rechner").
  const monitor = makeMonitor(0, -44.5);
  monitor.scale.setScalar(0.62); // passt in den Shop-Raum (Breite ~20)
  group.add(monitor);

  // Deko-Props in der Lounge (Westen) – stimmungsvolles Set-Dressing.
  group.add(makePlant(-50, 10));
  group.add(makeMug(-50, -10));
  group.add(makePenHolder(-40, 11));

  scene.add(group);
  return group;
}

// Umlaufender Hintergrund als großer Zylinder (Textur austauschbar).
export function buildBackdrop(scene, url = "./assets/textures/office_bg.png") {
  const geo = new THREE.CylinderGeometry(95, 95, 56, 48, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false, color: 0x0b0d12,
  });
  const cyl = new THREE.Mesh(geo, mat);
  cyl.position.y = 16;
  scene.add(cyl);
  setBackdropTexture(cyl, url);
  return cyl;
}

export function setBackdropTexture(cyl, url) {
  const loader = new THREE.TextureLoader();
  loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    cyl.material.map = tex;
    cyl.material.color.setHex(0xffffff);
    cyl.material.needsUpdate = true;
  });
}

// Boden bekommt die AI-Desk-Mat-Textur, sobald vorhanden.
export function applyDeskTexture(material, url = "./assets/textures/desk.png") {
  const loader = new THREE.TextureLoader();
  loader.load(
    url,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      tex.colorSpace = THREE.SRGBColorSpace;
      material.map = tex;
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
      console.info("[env] Desk-Textur geladen.");
    },
    undefined,
    () => {} // still: Fallback bleibt die Farbfläche
  );
}

// --- Props -----------------------------------------------------------------

function makeMonitor(x, z) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.5, metalness: 0.45 });

  // Großer, prominenter Monitor.
  const W = 32, H = 18;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, H, 1.1), dark);
  frame.position.set(0, H / 2 + 3, 0);
  g.add(frame);

  // Animierter, scrollender Build-Screen (leuchtet).
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 1.8, H - 1.8),
    new THREE.MeshBasicMaterial({ map: makeAnimatedScreen() })
  );
  screen.position.set(0, H / 2 + 3, 0.6);
  g.add(screen);

  // Breiter Standfuß.
  const neck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.5, 1.4), dark);
  neck.position.set(0, 2.2, 0);
  g.add(neck);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 0.7, 28), dark);
  base.position.set(0, 0.35, 0);
  g.add(base);

  g.position.set(x, 0, z);
  return g;
}

function makeKeyboard(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.7 })
  );
  body.position.y = 0.35;
  g.add(body);

  const keyMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6 });
  const cols = 18, rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.25, 0.62), keyMat);
      key.position.set(-7.6 + c * 0.85, 0.75, -1.7 + r * 0.85);
      g.add(key);
    }
  }
  g.position.set(x, 0, z);
  return g;
}

function makeMug(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.1, 2.6, 24), mat);
  body.position.y = 1.3;
  g.add(body);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.18, 10, 18), mat);
  handle.position.set(1.4, 1.3, 0);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);
  // Kaffee.
  const coffee = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.1, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.3 })
  );
  coffee.position.y = 2.55;
  g.add(coffee);
  g.position.set(x, 0, z);
  return g;
}

function makePlant(x, z) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.0, 2.2, 20),
    new THREE.MeshStandardMaterial({ color: 0xc4663b, roughness: 0.8 })
  );
  pot.position.y = 1.1;
  g.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3fa34d, roughness: 0.7 });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.2, 6), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.6, 3.0, Math.sin(a) * 0.6);
    leaf.rotation.z = Math.cos(a) * 0.5;
    leaf.rotation.x = -Math.sin(a) * 0.5;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}

function makePenHolder(x, z) {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 0.9, 2.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x2b3550, roughness: 0.5, metalness: 0.4 })
  );
  cup.position.y = 1.2;
  g.add(cup);
  const colors = [0xffd23f, 0x6ee7ff, 0xff6ec7, 0x80ed99];
  for (let i = 0; i < 4; i++) {
    const pen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 4, 8),
      new THREE.MeshStandardMaterial({ color: colors[i] })
    );
    pen.position.set((Math.random() - 0.5) * 0.8, 2.2, (Math.random() - 0.5) * 0.8);
    pen.rotation.z = (Math.random() - 0.5) * 0.6;
    pen.rotation.x = (Math.random() - 0.5) * 0.6;
    g.add(pen);
  }
  g.position.set(x, 0, z);
  return g;
}

function makeNotebook(x, z) {
  const g = new THREE.Group();
  const book = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.6, 7),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6 })
  );
  book.position.y = 0.3;
  book.rotation.y = 0.3;
  g.add(book);
  g.position.set(x, 0, z);
  return g;
}

// Animierter Build-Screen: scrollender Fake-Code, blinkender Cursor,
// gelegentlicher "BUILD ✓"-Flash. Läuft über setInterval (kein Loop-Hook nötig).
function makeAnimatedScreen() {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 380;
  const ctx = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const palette = ["#6ee7ff", "#ffd23f", "#ff6ec7", "#80ed99", "#9b5de5", "#5d6678"];
  const lineH = 22;
  const top = 38;
  const lines = [];

  function makeLine(y) {
    const indent = 14 + Math.floor(Math.random() * 4) * 16;
    const tokens = [];
    let x = indent;
    const n = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const w = 24 + Math.random() * 70;
      tokens.push({ w, col: palette[Math.floor(Math.random() * palette.length)] });
      x += w + 10;
      if (x > c.width - 40) break;
    }
    return { y, indent, tokens };
  }
  for (let y = top; y < c.height - 26; y += lineH) lines.push(makeLine(y));

  let t = 0, flash = 0, flashT = 4;
  const dots = ["#ff5470", "#ffd23f", "#80ed99"];

  function draw() {
    ctx.fillStyle = "#070a12";
    ctx.fillRect(0, 0, c.width, c.height);

    // Header.
    ctx.fillStyle = "#0f1622";
    ctx.fillRect(0, 0, c.width, 30);
    ctx.fillStyle = "#6ee7ff";
    ctx.font = "bold 18px ui-monospace, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.fillText("claude ~ building…", 14, 21);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = dots[i];
      ctx.beginPath();
      ctx.arc(c.width - 22 - i * 22, 15, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scrollende Code-Zeilen (unter dem Header geclippt).
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 30, c.width, c.height - 30);
    ctx.clip();
    for (const ln of lines) {
      let x = ln.indent;
      for (const tk of ln.tokens) {
        ctx.fillStyle = tk.col;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x, ln.y, tk.w, 9);
        x += tk.w + 10;
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Blinkender Cursor.
    if (Math.sin(t * 6) > 0) {
      ctx.fillStyle = "#80ed99";
      ctx.fillRect(16, c.height - 26, 12, 16);
    }

    // Status-Flash.
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.22;
      ctx.fillStyle = "#80ed99";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalAlpha = flash;
      ctx.fillStyle = "#80ed99";
      ctx.font = "bold 48px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillText("BUILD ✓", c.width / 2, c.height / 2);
      ctx.globalAlpha = 1;
    }
  }

  setInterval(() => {
    t += 0.07;
    for (const ln of lines) ln.y -= 2.4;
    while (lines.length && lines[0].y < top) lines.shift();
    let lastY = lines.length ? lines[lines.length - 1].y : top;
    while (lastY < c.height - 26) { lastY += lineH; lines.push(makeLine(lastY)); }
    flashT -= 0.07;
    if (flashT <= 0) { flash = 1; flashT = 5 + Math.random() * 4; }
    if (flash > 0) flash = Math.max(0, flash - 0.04);
    draw();
    tex.needsUpdate = true;
  }, 70);

  draw();
  return tex;
}
