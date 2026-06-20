// Geschosse: echte, physisch wirkende Patronen (Messing-/Bleikern, metallisch,
// NICHT leuchtend). Jede Kugel richtet sich an ihrer Flugrichtung aus und zieht
// einen kurzen, dezenten Rauch-/Tracer-Streak (nicht additiv) hinter sich her.
import * as THREE from "three";
import { CONFIG } from "./config.js";

const BOUND = 140;

// Größe je Waffenstil (skaliert die Patrone).
const STYLE = {
  ball: 1.0,
  pellet: 0.85,
  tracer: 0.8,
  laser: 1.05,
  plasma: 1.7,
  saw: 1.7,
  star: 0.7,
};

// Eine geteilte Patronen-Geometrie (Hülse/Body + Ogiven-Spitze), Längsachse +Z.
function makeBulletGeometry() {
  const parts = [];
  const body = new THREE.CylinderGeometry(0.07, 0.075, 0.26, 10);
  body.rotateX(Math.PI / 2); // Längsachse -> +Z
  body.translate(0, 0, -0.04);
  parts.push(body);
  const tip = new THREE.ConeGeometry(0.07, 0.16, 10);
  tip.rotateX(Math.PI / 2);
  tip.translate(0, 0, 0.17);
  parts.push(tip);
  // simple Merge ohne BufferGeometryUtils-Import: per Hand zusammenführen
  return mergeGeos(parts);
}

function mergeGeos(geos) {
  let vCount = 0, iCount = 0;
  for (const g of geos) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const idx = new Uint16Array(iCount);
  let vo = 0, io = 0, base = 0;
  for (const g of geos) {
    const gp = g.attributes.position.array;
    const gn = g.attributes.normal.array;
    pos.set(gp, vo * 3);
    nor.set(gn, vo * 3);
    const gi = g.index ? g.index.array : null;
    const cnt = g.attributes.position.count;
    if (gi) {
      for (let k = 0; k < gi.length; k++) idx[io++] = gi[k] + base;
    } else {
      for (let k = 0; k < cnt; k++) idx[io++] = k + base;
    }
    vo += cnt; base += cnt;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  merged.setIndex(new THREE.BufferAttribute(idx, 1));
  return merged;
}

export class ProjectileSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.bulletGeo = makeBulletGeometry();
    this.bulletMat = new THREE.MeshStandardMaterial({
      color: 0xc8a23a, metalness: 0.95, roughness: 0.32,
    });

    this.pool = [];
    this.active = [];
    this.trailPool = [];
    this.trails = [];
  }

  spawn(origin, dir, opts = {}) {
    let p = this.pool.pop();
    if (!p) {
      const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
      mesh.castShadow = false;
      p = { mesh, vel: new THREE.Vector3(), life: 0, trailT: 0, hits: new Set() };
      this.group.add(mesh);
    }

    p.color = opts.color ?? CONFIG.colors.projectile;
    p.mesh.visible = true;
    const s = (opts.scale ?? 1) * (STYLE[opts.style] || STYLE.ball);
    p.mesh.scale.setScalar(s);
    p.mesh.position.set(origin.x, 1.0, origin.z);

    const speed = opts.speed ?? CONFIG.weapon.projSpeed;
    p.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);
    // Patrone in Flugrichtung ausrichten (Spitze nach vorn).
    p.mesh.rotation.set(0, Math.atan2(p.vel.x, p.vel.z), 0);

    p.life = CONFIG.weapon.projLife;
    p.damage = opts.damage ?? CONFIG.weapon.damage;
    p.pierce = opts.pierce ?? 0;
    p.hitR = CONFIG.weapon.projRadius * s * 0.95; // Trefferradius wie zuvor (Bullet optisch kleiner)
    p.trailT = 0;
    p.fast = speed > 70; // schnelle Waffen bekommen einen leichten Tracer
    p.hits.clear();
    this.active.push(p);
    return p;
  }

  _spawnTrail(x, z, color, scale, fast) {
    let t = this.trailPool.pop();
    if (!t) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false,
      });
      const spr = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat);
      t = { spr, life: 0, max: 0.12 };
      this.group.add(spr);
    }
    // Dezenter, neutraler Rauch (kein additives Neon). Tracer-Waffen minimal wärmer.
    t.spr.material.color.setHex(fast ? 0xffe6b0 : 0xbfc4cc);
    t.spr.material.opacity = fast ? 0.3 : 0.18;
    t.spr.visible = true;
    t.spr.scale.setScalar(scale * 0.6);
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

      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.02;
        this._spawnTrail(p.mesh.position.x, p.mesh.position.z, p.color, p.mesh.scale.x, p.fast);
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
      const k = Math.max(0, t.life / t.max);
      t.spr.material.opacity *= 0.86;
      t.spr.scale.multiplyScalar(0.9);
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
