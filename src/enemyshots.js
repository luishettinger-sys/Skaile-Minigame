// Gegner-Projektile (z.B. Null-Pointer-Bolts, Boss-Fächer). Treffen den Spieler.
import * as THREE from "three";

const BOUND = 150;

function makeGlow() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class EnemyShots {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.tex = makeGlow();
    this.pool = [];
    this.active = [];
  }

  spawn(x, z, dx, dz, opts = {}) {
    let s = this.pool.pop();
    if (!s) {
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.tex, transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      s = { spr, vel: new THREE.Vector3(), life: 0 };
      this.group.add(spr);
    }
    s.spr.material.color.setHex(opts.color ?? 0xff5470);
    s.spr.visible = true;
    // Größer (besser sichtbar) + langsamer (besser ausweichbar). Die Trefferzone
    // (radius) bleibt bewusst KLEINER als die Optik → fair/forgiving zu treffen.
    s.spr.scale.setScalar(opts.size ?? 1.5);
    s.spr.position.set(x, 1.1, z);
    const sp = opts.speed ?? 15;
    const l = Math.hypot(dx, dz) || 1;
    s.vel.set((dx / l) * sp, 0, (dz / l) * sp);
    s.life = opts.life ?? 3.2;
    s.damage = opts.damage ?? 8;
    s.radius = opts.radius ?? 0.7;
    this.active.push(s);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      s.life -= dt;
      s.spr.position.x += s.vel.x * dt;
      s.spr.position.z += s.vel.z * dt;
      if (
        s.life <= 0 ||
        Math.abs(s.spr.position.x) > BOUND ||
        Math.abs(s.spr.position.z) > BOUND
      ) {
        this.retire(i);
      }
    }
  }

  retire(i) {
    const s = this.active[i];
    s.spr.visible = false;
    this.active.splice(i, 1);
    this.pool.push(s);
  }

  reset() {
    while (this.active.length) this.retire(this.active.length - 1);
  }
}
