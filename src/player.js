// Die Helden-Gummiente: Movement, HP, Waddle-Animation.
// Platzhalter-Mesh aus Primitiven; setModel() tauscht später das AI-GLB rein.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { clamp, damp } from "./utils.js";

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.placeholder = buildDuck();
    this.root.add(this.placeholder);
    this.model = null; // wird durch setModel() gefüllt

    this.pos = this.root.position;
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.phase = 0;

    this.maxHp = CONFIG.player.maxHp;
    this.hp = this.maxHp;
    this.invuln = 0;
    this.alive = true;
  }

  update(dt, move) {
    const speed = CONFIG.player.speed;
    this.vel.set(move.x * speed, 0, move.z * speed);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // In der Arena halten.
    const lim = CONFIG.arena.half - CONFIG.player.radius;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);

    // In Laufrichtung drehen (weich).
    const moving = move.x !== 0 || move.z !== 0;
    if (moving) {
      const target = Math.atan2(move.x, move.z);
      this.facing = dampAngle(this.facing, target, CONFIG.player.turnLerp, dt);
    }
    this.root.rotation.y = this.facing;

    // Waddle + Bob beim Laufen.
    this.phase += dt * (moving ? 14 : 4);
    const waddle = moving ? Math.sin(this.phase) * 0.18 : 0;
    const bob = moving ? Math.abs(Math.sin(this.phase)) * 0.12 : 0;
    this.root.rotation.z = waddle;
    this.pos.y = bob;

    // Unverwundbarkeit + Blink-Feedback.
    if (this.invuln > 0) {
      this.invuln = Math.max(0, this.invuln - dt);
      const blink = Math.sin(this.invuln * 40) > 0;
      this._setVisible(blink || this.invuln === 0);
    }
  }

  takeDamage(amount) {
    if (this.invuln > 0 || !this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = CONFIG.player.hitInvuln;
    if (this.hp <= 0) {
      this.alive = false;
    }
    return true;
  }

  // Muzzle-Position für Projektile (leicht vor der Ente).
  muzzle() {
    return new THREE.Vector3(this.pos.x, 1.0, this.pos.z);
  }

  reset() {
    this.pos.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.facing = 0;
    this.hp = this.maxHp;
    this.invuln = 0;
    this.alive = true;
    this._setVisible(true);
  }

  // Tauscht das Platzhalter-Mesh gegen ein geladenes GLB-Modell (M4).
  setModel(object3d) {
    if (this.model) this.root.remove(this.model);
    this.placeholder.visible = false;
    this.model = object3d;
    this.root.add(object3d);
  }

  _setVisible(v) {
    this.root.visible = v;
  }
}

// Winkel-Interpolation über die kürzeste Distanz (kein 359°→0°-Sprung).
function dampAngle(a, b, lambda, dt) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * (1 - Math.exp(-lambda * dt));
}

// Platzhalter-Ente aus Primitiven (klassischer Quietsche-Enten-Look).
function buildDuck() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.duckBody, roughness: 0.45, metalness: 0.05,
  });
  const beakMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.duckBeak, roughness: 0.5,
  });
  const darkMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.duckEye });

  // Körper (Ellipsoid).
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 16), bodyMat);
  body.scale.set(1.1, 0.9, 1.3);
  body.position.y = 0.7;
  g.add(body);

  // Kopf.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), bodyMat);
  head.position.set(0, 1.45, 0.5);
  g.add(head);

  // Schnabel.
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 12), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.42, 1.05);
  g.add(beak);

  // Augen + Entwickler-Brille.
  for (const sx of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), darkMat);
    eye.position.set(sx, 1.55, 0.92);
    g.add(eye);
    const glasses = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.035, 8, 16),
      darkMat
    );
    glasses.position.set(sx, 1.55, 0.9);
    g.add(glasses);
  }

  // Schwänzchen.
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 10), bodyMat);
  tail.rotation.x = -Math.PI / 2.4;
  tail.position.set(0, 0.95, -1.15);
  g.add(tail);

  return g;
}
