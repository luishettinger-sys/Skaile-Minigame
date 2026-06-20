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

    // Geteilte Ressourcen (eine Geo, ein Material → günstig).
    this.geo = new THREE.SphereGeometry(CONFIG.weapon.projRadius, 12, 12);
    this.mat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.projectile });
  }

  spawn(origin, dir) {
    let p = this.pool.pop();
    if (!p) {
      const mesh = new THREE.Mesh(this.geo, this.mat);
      p = { mesh, vel: new THREE.Vector3(), life: 0 };
      this.group.add(mesh);
    }
    p.mesh.visible = true;
    p.mesh.position.set(origin.x, 1.0, origin.z);
    p.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(CONFIG.weapon.projSpeed);
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
