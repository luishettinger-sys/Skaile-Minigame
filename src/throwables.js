// Aufhebbare & werfbare Objekte (Golfbag, Ballbox). Mit F aufheben/werfen;
// beim Aufprall Flächenschaden an Gegnern.
import * as THREE from "three";
import { distXZ } from "./utils.js";

export class Throwables {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.flying = []; // automatisch geworfene TNTs (mit Ziel-Bogen)
    this._t = 0;
    // Keine statischen Würfe mehr auf der Map – Granaten erscheinen gelegentlich
    // während der Wellen (siehe spawnPickup), mit (F)-Hinweis.
  }

  // Eine aufhebbare Granate an (x,z) spawnen, mit schwebendem „[F]"-Hinweis.
  spawnPickup(x, z) {
    if (this.items.filter((i) => i.state === "idle").length >= 3) return; // nicht zumüllen
    const mesh = makeTNT();
    mesh.position.set(x, 0, z);
    this.group.add(mesh);
    const spr = makeFLabel();
    spr.position.set(x, 2.5, z);
    this.group.add(spr);
    this.items.push({ kind: "tnt", mesh, spr, state: "idle", home: { x, z }, vel: new THREE.Vector3(), vy: 0 });
  }

  // Automatisch eine TNT von 'from' auf 'target' werfen (schöner Bogen).
  autoThrow(from, target) {
    const mesh = makeTNT();
    mesh.position.set(from.x, 2.2, from.z);
    this.group.add(mesh);
    const T = 0.65; // Flugzeit
    const g = 24;
    const vx = (target.x - from.x) / T;
    const vz = (target.z - from.z) / T;
    const vy = (0.5 * g * T * T - 2.2) / T; // landet bei y=0 (Start y=2.2)
    this.flying.push({ mesh, vx, vz, vy, g });
  }

  _spawnAll() {
    this._spawn("tnt", -19, -12);
    this._spawn("balls", 19, 11);
    this._spawn("tnt", -20, 17);
    this._spawn("golf", 12, 19);
  }

  _spawn(kind, x, z) {
    const mesh = kind === "tnt" ? makeTNT() : kind === "golf" ? makeGolfBag() : makeBallBox();
    mesh.position.set(x, 0, z);
    this.group.add(mesh);
    this.items.push({ kind, mesh, state: "idle", home: { x, z }, vel: new THREE.Vector3(), vy: 0 });
  }

  nearestIdle(pos, r) {
    let best = null, bd = r;
    for (const it of this.items) {
      if (it.state !== "idle") continue;
      const d = distXZ(pos, it.mesh.position);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  // Auto-Aim-Wurf: Bogen, der genau auf (tx,tz) landet (trifft immer).
  throwItemAt(it, tx, tz) {
    it.state = "thrown";
    if (it.spr) it.spr.visible = false;
    const T = 0.7, g = 24;
    const sy = it.mesh.position.y;
    it.vel.set((tx - it.mesh.position.x) / T, 0, (tz - it.mesh.position.z) / T);
    it.vy = (0.5 * g * T * T - sy) / T; // landet bei y=0 nach ~T
  }

  throwItem(it, dirx, dirz) {
    it.state = "thrown";
    const sp = 26;
    const l = Math.hypot(dirx, dirz) || 1;
    it.vel.set((dirx / l) * sp, 0, (dirz / l) * sp);
    it.vy = 8;
  }

  update(dt, onImpact) {
    this._t += dt;

    // Automatisch geworfene TNTs: Bogen fliegen, beim Aufprall explodieren.
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.vy -= f.g * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.z += f.vz * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.rotation.x += dt * 8;
      f.mesh.rotation.z += dt * 6;
      const spark = f.mesh.userData.spark;
      if (spark) spark.scale.setScalar(0.8 + Math.sin(this._t * 18) * 0.4);
      if (f.mesh.position.y <= 0) {
        onImpact(f.mesh.position.x, f.mesh.position.z);
        this.group.remove(f.mesh);
        this.flying.splice(i, 1);
      }
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.state === "thrown") {
        it.vy -= 24 * dt;
        it.mesh.position.x += it.vel.x * dt;
        it.mesh.position.z += it.vel.z * dt;
        it.mesh.position.y += it.vy * dt;
        it.mesh.rotation.x += dt * 9;
        it.mesh.rotation.z += dt * 7;
        if (it.mesh.position.y <= 0) {
          onImpact(it.mesh.position.x, it.mesh.position.z); // explodiert
          this.group.remove(it.mesh);                       // verbraucht
          this.items.splice(i, 1);
          continue;
        }
      } else if (it.state === "idle") {
        it.mesh.rotation.y += dt * 0.5;
        it.mesh.position.y = Math.sin(this._t * 2 + it.home.x) * 0.05;
      }
      // (F)-Hinweis nur im idle-Zustand sichtbar, schwebt über der Granate.
      if (it.spr) {
        it.spr.visible = it.state === "idle";
        if (it.state === "idle") it.spr.position.set(it.mesh.position.x, 2.5 + Math.sin(this._t * 3) * 0.12, it.mesh.position.z);
      }
      const spark = it.mesh.userData.spark;
      if (spark) spark.scale.setScalar(0.8 + Math.sin(this._t * 12 + it.home.x) * 0.35);
    }
  }

  reset() {
    for (const it of this.items) { this.group.remove(it.mesh); if (it.spr) this.group.remove(it.spr); }
    this.items = [];
    for (const f of this.flying) this.group.remove(f.mesh);
    this.flying = [];
  }
}

// Schwebendes „[F]"-Hinweis-Label (über aufhebbaren Granaten).
function makeFLabel() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(20,24,34,0.85)";
  roundRect(ctx, 6, 8, 116, 48, 12); ctx.fill();
  ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3;
  roundRect(ctx, 6, 8, 116, 48, 12); ctx.stroke();
  ctx.fillStyle = "#ffd23f";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("[F] 💣", 64, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  spr.scale.set(2.6, 1.3, 1);
  spr.renderOrder = 999;
  return spr;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeTNT() {
  const g = new THREE.Group();
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.65 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.5, metalness: 0.3 });
  // Drei gebündelte Dynamit-Stangen.
  for (let i = 0; i < 3; i++) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.5, 16), stickMat);
    stick.position.set((i - 1) * 0.46, 0.75, 0);
    g.add(stick);
  }
  // Zwei dunkle Spannbänder um das Bündel.
  for (const y of [0.45, 1.05]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.58), bandMat);
    band.position.set(0, y, 0);
    g.add(band);
  }
  // Glühende Zündschnur-Spitze (leuchtet bewusst → Bloom-Funke).
  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a5a2b, roughness: 0.8 })
  );
  fuse.position.set(0.46, 1.65, 0);
  fuse.rotation.z = 0.4;
  g.add(fuse);
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe066 })
  );
  spark.position.set(0.6, 1.83, 0);
  g.userData.spark = spark; // für pulsierendes Funkeln
  g.add(spark);
  return g;
}

function makeGolfBag() {
  const g = new THREE.Group();
  const bag = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.6, 2.0, 14),
    new THREE.MeshStandardMaterial({ color: 0xff5470, roughness: 0.6 })
  );
  bag.position.y = 1.0;
  g.add(bag);
  const colors = [0xffd23f, 0x6ee7ff, 0x80ed99];
  for (let i = 0; i < 3; i++) {
    const club = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: colors[i] })
    );
    club.position.set((i - 1) * 0.22, 2.0, 0.15);
    club.rotation.z = (i - 1) * 0.12;
    g.add(club);
  }
  return g;
}

function makeBallBox() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.0, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 })
  );
  box.position.y = 0.5;
  g.add(box);
  const colors = [0xffd23f, 0x6ee7ff, 0x80ed99, 0xff6ec7];
  for (let i = 0; i < 5; i++) {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length] })
    );
    ball.position.set((Math.random() - 0.5) * 0.8, 1.0 + Math.random() * 0.2, (Math.random() - 0.5) * 0.8);
    g.add(ball);
  }
  return g;
}
