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

    this.dashTimer = 0; // verbleibende Dash-Dauer
    this.dashCD = 0; // verbleibender Cooldown
    this.lastDir = { x: 0, z: 1 }; // Richtung für Dash im Stand
    this.arenaHalf = CONFIG.arena.half; // wächst mit der Arena
    this.cosmetics = { helmet: null, shades: null, cape: null };
    this.terrain = null; // wird von Game gesetzt (Höhen-Sampling)
  }

  // Dash auslösen (Ausweichen mit i-Frames). Gibt true zurück, wenn erfolgreich.
  tryDash(cooldown) {
    if (this.dashCD > 0 || !this.alive) return false;
    this.dashTimer = CONFIG.player.dash.duration;
    this.dashCD = cooldown;
    this.invuln = Math.max(this.invuln, CONFIG.player.dash.iframes);
    return true;
  }

  update(dt, move, moveSpeed = CONFIG.player.speed) {
    if (this.dashCD > 0) this.dashCD = Math.max(0, this.dashCD - dt);

    let speed = moveSpeed;
    const dashing = this.dashTimer > 0;
    if (dashing) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      speed *= CONFIG.player.dash.mult;
    }
    if (move.x !== 0 || move.z !== 0) this.lastDir = { x: move.x, z: move.z };
    // Im Stand nur während eines Dash in die letzte Richtung gleiten.
    const dir =
      move.x !== 0 || move.z !== 0 ? move : dashing ? this.lastDir : { x: 0, z: 0 };
    this.vel.set(dir.x * speed, 0, dir.z * speed);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // In der (wachsenden) Arena halten.
    const lim = this.arenaHalf - CONFIG.player.radius;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);

    // Blickrichtung wird extern via Maus-Zielen gesetzt (this.facing).
    const moving = move.x !== 0 || move.z !== 0;
    this.root.rotation.y = this.facing;

    // Lebendige Bewegung: Waddle, Bob, Lean, Squash & Stretch, Idle-Atmen.
    this.phase += dt * (moving ? 16 : 3);
    const swing = Math.sin(this.phase);
    const waddle = moving ? swing * 0.22 : swing * 0.03;
    const bob = moving ? Math.abs(swing) * 0.18 : Math.abs(swing) * 0.04;
    this.root.rotation.z = waddle;
    this.root.rotation.x = moving ? 0.14 : 0; // beim Laufen leicht nach vorn

    // Squash & Stretch (volumen-erhaltend) – der Footfall „staucht" die Ente.
    const squash = 1 - Math.abs(swing) * (moving ? 0.09 : 0.02);
    const stretch = 1 / Math.sqrt(squash);
    this.root.scale.set(stretch, squash, stretch);

    // Höhe: auf Plattformen/Stufen steigen (weich nachziehen).
    const groundY = this.terrain ? this.terrain.heightAt(this.pos.x, this.pos.z) : 0;
    const targetY = groundY + bob;
    this.pos.y += (targetY - this.pos.y) * (1 - Math.exp(-14 * dt));

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

  // --- Kosmetik (freischaltbar) --------------------------------------------
  addHelmet() {
    if (this.cosmetics.helmet) return false;
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.35, metalness: 0.4 });
    const g = new THREE.Group();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.56, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat
    );
    dome.position.y = 2.05;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.09, 8, 20), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 2.0;
    g.add(dome, rim);
    this.cosmetics.helmet = g;
    this.root.add(g);
    return true;
  }

  addShades() {
    if (this.cosmetics.shades) return false;
    const mat = new THREE.MeshBasicMaterial({ color: 0x10131a });
    const g = new THREE.Group();
    for (const sx of [-0.22, 0.22]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.06), mat);
      lens.position.set(sx, 1.6, 0.92);
      g.add(lens);
    }
    this.cosmetics.shades = g;
    this.root.add(g);
    return true;
  }

  addCape() {
    if (this.cosmetics.cape) return false;
    const mat = new THREE.MeshStandardMaterial({ color: 0xff5470, roughness: 0.6, side: THREE.DoubleSide });
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), mat);
    cape.position.set(0, 1.0, -0.9);
    cape.rotation.x = 0.25;
    this.cosmetics.cape = cape;
    this.root.add(cape);
    return true;
  }

  // Aktives Gadget als kleines schwebendes Emoji-Symbol an der Ente.
  setGadget(icon) {
    if (this.gadgetSprite) { this.root.remove(this.gadgetSprite); this.gadgetSprite = null; }
    if (!icon) return;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    ctx.font = "96px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, 64, 72);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(1.1, 1.1, 1);
    spr.position.set(0, 2.8, -0.4);
    this.gadgetSprite = spr;
    this.root.add(spr);
  }

  _clearCosmetics() {
    for (const k of Object.keys(this.cosmetics)) {
      if (this.cosmetics[k]) this.root.remove(this.cosmetics[k]);
      this.cosmetics[k] = null;
    }
  }

  // Muzzle-Position für Projektile (leicht vor der Ente).
  muzzle() {
    return new THREE.Vector3(this.pos.x, 1.0, this.pos.z);
  }

  reset() {
    this.pos.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.facing = 0;
    this.maxHp = CONFIG.player.maxHp;
    this.hp = this.maxHp;
    this.invuln = 0;
    this.alive = true;
    this.dashTimer = 0;
    this.dashCD = 0;
    this.arenaHalf = CONFIG.arena.half;
    this._clearCosmetics();
    this.setGadget(null);
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
