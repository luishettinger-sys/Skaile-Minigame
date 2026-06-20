// Geschosse: leuchtende, fliegende Munitionskugeln (heller Kern + Glow-Halo).
// Pro Schuss: Farbe, Größe, Speed, Schaden, Durchschlag.
import * as THREE from "three";
import { CONFIG } from "./config.js";

const BOUND = 130; // großzügige Grenze, damit Geschosse irgendwann recyceln

export class ProjectileSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pool = [];
    this.active = [];

    const r = CONFIG.weapon.projRadius;
    this.coreGeo = new THREE.SphereGeometry(r, 14, 12);
    this.glowGeo = new THREE.SphereGeometry(r * 2.0, 12, 10);
  }

  spawn(origin, dir, opts = {}) {
    let p = this.pool.pop();
    if (!p) {
      // Eigene Materialien je Geschoss → Farbe pro Schuss/Waffe möglich.
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false,
      });
      const mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(this.glowGeo, glowMat), new THREE.Mesh(this.coreGeo, coreMat));
      p = { mesh, coreMat, glowMat, vel: new THREE.Vector3(), life: 0, hits: new Set() };
      this.group.add(mesh);
    }

    const color = opts.color ?? CONFIG.colors.projectile;
    p.coreMat.color.setHex(0xffffff);
    p.glowMat.color.setHex(color);

    p.mesh.visible = true;
    p.mesh.scale.setScalar(opts.scale ?? 1);
    p.mesh.position.set(origin.x, 1.0, origin.z);

    const speed = opts.speed ?? CONFIG.weapon.projSpeed;
    p.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);
    p.life = CONFIG.weapon.projLife;
    p.damage = opts.damage ?? CONFIG.weapon.damage;
    p.pierce = opts.pierce ?? 0;
    p.hits.clear();
    this.active.push(p);
    return p;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.z += p.vel.z * dt;
      if (
        p.life <= 0 ||
        Math.abs(p.mesh.position.x) > BOUND ||
        Math.abs(p.mesh.position.z) > BOUND
      ) {
        this.retire(i);
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
  }
}
