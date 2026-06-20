// Geschosse: leuchtende additive Energie-Sprites (weißer Kern + farbiger Glow)
// mit nachziehendem Trail. Pro Schuss: Farbe, Größe, Speed, Schaden, Durchschlag.
import * as THREE from "three";
import { CONFIG } from "./config.js";

const BOUND = 140;

// Größe je Waffenstil (Sprite-Skalierung; Trail erzeugt den Streak).
const STYLE = {
  ball: 1.1,
  pellet: 0.8,
  tracer: 0.7,
  laser: 0.85,
  plasma: 1.9,
};

// Weiche radiale Glow-Textur (einmal, geteilt).
function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export class ProjectileSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.tex = makeGlowTexture();

    this.pool = [];
    this.active = [];
    this.trailPool = [];
    this.trails = [];
  }

  _spriteMat(color, opacity = 1) {
    return new THREE.SpriteMaterial({
      map: this.tex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
  }

  spawn(origin, dir, opts = {}) {
    let p = this.pool.pop();
    if (!p) {
      const grp = new THREE.Group();
      const glow = new THREE.Sprite(this._spriteMat(0xffffff, 0.9));
      const core = new THREE.Sprite(this._spriteMat(0xffffff, 1));
      core.scale.set(0.45, 0.45, 1);
      grp.add(glow, core);
      p = { mesh: grp, glow, core, vel: new THREE.Vector3(), life: 0, trailT: 0, hits: new Set() };
      this.group.add(grp);
    }

    const color = opts.color ?? CONFIG.colors.projectile;
    p.glow.material.color.setHex(color);
    p.color = color;

    p.mesh.visible = true;
    const s = (opts.scale ?? 1) * (STYLE[opts.style] || STYLE.ball);
    p.mesh.scale.setScalar(s);
    p.mesh.position.set(origin.x, 1.0, origin.z);

    const speed = opts.speed ?? CONFIG.weapon.projSpeed;
    p.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);
    p.life = CONFIG.weapon.projLife;
    p.damage = opts.damage ?? CONFIG.weapon.damage;
    p.pierce = opts.pierce ?? 0;
    p.hitR = CONFIG.weapon.projRadius * s * 0.9;
    p.trailT = 0;
    p.hits.clear();
    this.active.push(p);
    return p;
  }

  _spawnTrail(x, z, color, scale) {
    let t = this.trailPool.pop();
    if (!t) {
      const spr = new THREE.Sprite(this._spriteMat(0xffffff, 0.5));
      t = { spr, life: 0, max: 0.18 };
      this.group.add(spr);
    }
    t.spr.material.color.setHex(color);
    t.spr.material.opacity = 0.5;
    t.spr.visible = true;
    t.spr.scale.setScalar(scale * 0.8);
    t.spr.position.set(x, 1.0, z);
    t.life = t.max;
    this.trails.push(t);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.z += p.vel.z * dt;

      // Trail abwerfen.
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.014;
        this._spawnTrail(p.mesh.position.x, p.mesh.position.z, p.color, p.mesh.scale.x);
      }

      if (
        p.life <= 0 ||
        Math.abs(p.mesh.position.x) > BOUND ||
        Math.abs(p.mesh.position.z) > BOUND
      ) {
        this.retire(i);
      }
    }

    // Trails ausblenden.
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= dt;
      const k = Math.max(0, t.life / t.max);
      t.spr.material.opacity = 0.5 * k;
      t.spr.scale.multiplyScalar(0.92);
      if (t.life <= 0) {
        t.spr.visible = false;
        this.trails.splice(i, 1);
        this.trailPool.push(t);
      }
    }
  }

  retire(i) {
    const p = this.active[i];
    p.mesh.visible = false;
    this.active.splice(i, 1);
    this.pool.push(p);
  }

  reset() {
    while (this.active.length) this.retire(this.active.length - 1);
    for (const t of this.trails) { t.spr.visible = false; this.trailPool.push(t); }
    this.trails = [];
  }
}
