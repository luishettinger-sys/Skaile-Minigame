// Geschosse: pro Waffenstil eine eigene, glühende Optik (Energie-Orbs,
// Laserstrahlen, rotierende Sägeblätter, helle Tracer, Plasmakugeln, Sterne).
// Jedes Geschoss leuchtet (emissive → Bloom) und zieht einen farbigen Glow-Trail.
// Gepoolt pro Stil; Schnittstelle (spawn/active/retire/reset) bleibt erhalten.
import * as THREE from "three";
import { CONFIG } from "./config.js";

const BOUND = 160;

// Trefferradius-Multiplikator je Stil (hält das Balancing wie zuvor).
const HIT = { ball: 1.0, pellet: 0.85, tracer: 0.8, laser: 1.05, plasma: 1.7, saw: 1.7, star: 0.7 };
// Drehende Stile.
const SPIN = { saw: 16, star: 9 };
// Stile, deren Längsachse sich an der Flugrichtung ausrichtet.
const ALIGN = { tracer: true, laser: true };

function makeGeometries() {
  const g = {};
  g.ball = new THREE.SphereGeometry(0.26, 14, 12);
  g.pellet = new THREE.IcosahedronGeometry(0.2, 0);
  // Tracer/Laser: lange Achse entlang +Z.
  g.tracer = new THREE.CylinderGeometry(0.07, 0.07, 1.3, 8).rotateX(Math.PI / 2);
  g.laser = new THREE.CylinderGeometry(0.13, 0.13, 2.6, 10).rotateX(Math.PI / 2);
  g.plasma = new THREE.SphereGeometry(0.5, 16, 14);
  // Sägeblatt: flache, gezahnte Scheibe (liegt waagerecht).
  g.saw = new THREE.CylinderGeometry(0.62, 0.62, 0.12, 12);
  g.star = new THREE.OctahedronGeometry(0.3, 0);
  return g;
}

export class ProjectileSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.geos = makeGeometries();
    this.pools = {}; // style -> []
    this.active = [];
    this.trailPool = [];
    this.trails = [];
  }

  _make(style) {
    const geo = this.geos[style] || this.geos.ball;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0,
      metalness: style === "saw" ? 0.8 : 0.2, roughness: 0.35,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    this.group.add(mesh);
    return { mesh, vel: new THREE.Vector3(), life: 0, trailT: 0, hits: new Set(), style };
  }

  spawn(origin, dir, opts = {}) {
    const style = opts.style || "ball";
    const pool = (this.pools[style] ||= []);
    let p = pool.pop();
    if (!p) p = this._make(style);

    const color = opts.color ?? CONFIG.colors.projectile;
    p.color = color;
    p.mesh.material.color.setHex(color);
    p.mesh.material.emissive.setHex(color);
    p.mesh.visible = true;

    const scale = opts.scale ?? 1;
    p.mesh.scale.setScalar(scale);
    p.mesh.position.set(origin.x, 1.0, origin.z);

    const speed = opts.speed ?? CONFIG.weapon.projSpeed;
    p.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);

    // Ausrichtung: Tracer/Laser entlang der Flugrichtung, Rest neutral.
    const yaw = Math.atan2(p.vel.x, p.vel.z);
    p.mesh.rotation.set(0, ALIGN[style] ? yaw : 0, 0);
    if (style === "saw") p.mesh.rotation.x = 0; // Scheibe liegt flach
    p.spin = SPIN[style] || 0;
    p.align = !!ALIGN[style];

    p.life = CONFIG.weapon.projLife;
    p.damage = opts.damage ?? CONFIG.weapon.damage;
    p.pierce = opts.pierce ?? 0;
    p.hitR = CONFIG.weapon.projRadius * scale * (HIT[style] || 1) * 1.2;
    p.trailT = 0;
    p.hits.clear();
    this.active.push(p);
    return p;
  }

  _spawnTrail(x, z, color, scale) {
    let t = this.trailPool.pop();
    if (!t) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const spr = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 7), mat);
      t = { spr, life: 0, max: 0.22 };
      this.group.add(spr);
    }
    t.spr.material.color.setHex(color);
    t.spr.material.opacity = 0.55;
    t.spr.visible = true;
    t.spr.scale.setScalar(scale * 0.9);
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

      // Drehende Stile (Säge/Stern) rotieren um die Hochachse.
      if (p.spin) p.mesh.rotation.y += p.spin * dt;

      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.018;
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

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= dt;
      t.spr.material.opacity *= 0.82;
      t.spr.scale.multiplyScalar(0.86);
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
    (this.pools[p.style] ||= []).push(p);
  }

  reset() {
    while (this.active.length) this.retire(this.active.length - 1);
    for (const t of this.trails) { t.spr.visible = false; this.trailPool.push(t); }
    this.trails = [];
  }
}
