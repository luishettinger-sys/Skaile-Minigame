// Quak-Projektile: gepooltes System leuchtender Schallwellen-Kugeln.
import * as THREE from "three";
import { CONFIG } from "./config.js";

export class ProjectileSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pool = [];
    this.active = [];

    // Echtes Geschoss: ein gestreckter Energie-Bolt (Kapsel) + heller Glow-Kern.
    const r = CONFIG.weapon.projRadius;
    const len = CONFIG.weapon.projLen;
    this.geo = new THREE.CapsuleGeometry(r, len, 4, 8);
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.glowMat = new THREE.MeshBasicMaterial({
      color: CONFIG.colors.projectile, transparent: true, opacity: 0.5,
    });
    this.glowGeo = new THREE.CapsuleGeometry(r * 1.9, len, 4, 8);
  }

  spawn(origin, dir) {
    let p = this.pool.pop();
    if (!p) {
      const mesh = new THREE.Group();
      const core = new THREE.Mesh(this.geo, this.coreMat);
      const glow = new THREE.Mesh(this.glowGeo, this.glowMat);
      // Kapsel-Längsachse ist Y → um 90° kippen, damit sie nach vorn (Z) zeigt.
      core.rotation.x = Math.PI / 2;
      glow.rotation.x = Math.PI / 2;
      mesh.add(glow, core);
      p = { mesh, vel: new THREE.Vector3(), life: 0 };
      this.group.add(mesh);
    }
    p.mesh.visible = true;
    p.mesh.position.set(origin.x, 1.0, origin.z);
    p.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(CONFIG.weapon.projSpeed);
    p.mesh.rotation.y = Math.atan2(p.vel.x, p.vel.z); // Bolt zeigt in Flugrichtung
    p.life = CONFIG.weapon.projLife;
    this.active.push(p);
    return p;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.z += p.vel.z * dt;

      // Außerhalb der Arena oder Lebenszeit vorbei → recyceln.
      const half = CONFIG.arena.half + 2;
      if (
        p.life <= 0 ||
        Math.abs(p.mesh.position.x) > half ||
        Math.abs(p.mesh.position.z) > half
      ) {
        this.retire(i);
      }
    }
  }

  // Projektil i aus active entfernen und in den Pool zurücklegen.
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
