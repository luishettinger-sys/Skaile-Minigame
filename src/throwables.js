// Aufhebbare & werfbare Objekte (Golfbag, Ballbox). Mit F aufheben/werfen;
// beim Aufprall Flächenschaden an Gegnern.
import * as THREE from "three";
import { distXZ } from "./utils.js";

export class Throwables {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this._t = 0;
    this._spawnAll();
  }

  _spawnAll() {
    this._spawn("golf", -19, -12);
    this._spawn("balls", 19, 11);
    this._spawn("balls", -20, 17);
    this._spawn("golf", 12, 19);
  }

  _spawn(kind, x, z) {
    const mesh = kind === "golf" ? makeGolfBag() : makeBallBox();
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

  throwItem(it, dirx, dirz) {
    it.state = "thrown";
    const sp = 26;
    const l = Math.hypot(dirx, dirz) || 1;
    it.vel.set((dirx / l) * sp, 0, (dirz / l) * sp);
    it.vy = 8;
  }

  update(dt, onImpact) {
    this._t += dt;
    for (const it of this.items) {
      if (it.state === "thrown") {
        it.vy -= 24 * dt;
        it.mesh.position.x += it.vel.x * dt;
        it.mesh.position.z += it.vel.z * dt;
        it.mesh.position.y += it.vy * dt;
        it.mesh.rotation.x += dt * 9;
        it.mesh.rotation.z += dt * 7;
        if (it.mesh.position.y <= 0) {
          it.mesh.position.y = 0;
          it.mesh.rotation.set(0, it.mesh.rotation.y, 0);
          it.state = "idle";
          it.vy = 0;
          onImpact(it.mesh.position.x, it.mesh.position.z);
        }
      } else if (it.state === "idle") {
        it.mesh.rotation.y += dt * 0.5;
        it.mesh.position.y = Math.sin(this._t * 2 + it.home.x) * 0.05;
      }
    }
  }

  reset() {
    for (const it of this.items) {
      it.state = "idle";
      it.vy = 0;
      it.mesh.position.set(it.home.x, 0, it.home.z);
      it.mesh.rotation.set(0, 0, 0);
    }
  }
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
