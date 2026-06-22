// Geschosse: pro Waffenstil eine eigene, glühende Optik (Energie-Orbs,
// Laserstrahlen, rotierende Sägeblätter, helle Tracer, Plasmakugeln, Sterne).
// Jedes Geschoss leuchtet (emissive → Bloom) und zieht einen farbigen Glow-Trail.
//
// Zusätzlich zu geradeaus-Flug unterstützt das System "behaviors" für die
// kreativen Waffen: homing (kurvt zum Gegner), boomerang (kommt zurück),
// wave (Schlängellinie), bounce (prallt an Wänden ab), orbit (kreist um die
// Ente), lob (Bogenwurf), blackhole (saugt Gegner an). Trefferbasierte
// Effekte (explode/split/chain) werden in game.js ausgewertet.
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
    this.glowTex = makeProjGlow(); // additiver Schein um jedes Geschoss (fake Bloom)
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
    // Additiver Glow-Halo → das Geschoss leuchtet sichtbar (kein Bloom mehr).
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xffffff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(style === "plasma" || style === "saw" ? 2.6 : 1.7, style === "plasma" || style === "saw" ? 2.6 : 1.7, 1);
    mesh.add(glow);
    this.group.add(mesh);
    return { mesh, glow, vel: new THREE.Vector3(), life: 0, trailT: 0, hits: new Set(), style };
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
    if (p.glow) p.glow.material.color.setHex(color);
    p.mesh.visible = true;

    const scale = opts.scale ?? 1;
    p.mesh.scale.setScalar(scale);
    p.mesh.position.set(origin.x, 1.0, origin.z);

    const speed = opts.speed ?? CONFIG.weapon.projSpeed;
    p.speed = speed;
    p.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);

    // Ausrichtung: Tracer/Laser entlang der Flugrichtung, Rest neutral.
    const yaw = Math.atan2(p.vel.x, p.vel.z);
    p.mesh.rotation.set(0, ALIGN[style] ? yaw : 0, 0);
    if (style === "saw") p.mesh.rotation.x = 0; // Scheibe liegt flach
    p.spin = SPIN[style] || 0;
    p.align = !!ALIGN[style];

    p.life = opts.life ?? CONFIG.weapon.projLife;
    p.damage = opts.damage ?? CONFIG.weapon.damage;
    p.pierce = opts.pierce ?? 0;
    p.hitR = CONFIG.weapon.projRadius * scale * (HIT[style] || 1) * 1.2;
    p.trailT = 0;
    p.hits.clear();

    // ---- Behavior-Felder (kreative Waffen) --------------------------------
    p.behavior = opts.behavior || null;
    p.age = 0;
    p.dirX = p.vel.x / speed; p.dirZ = p.vel.z / speed; // normierte Startrichtung
    // homing: wie schnell das Geschoss zum Ziel kurvt (rad/s)
    p.homingRate = opts.homingRate ?? 0;
    // boomerang: Zeit bis zur Umkehr; Rückkehr-Flag
    p.outTime = opts.outTime ?? 0.42;
    p.returning = false;
    // wave: Amplitude/Frequenz der Schlängelbewegung + Mittelpunkt
    p.waveAmp = opts.waveAmp ?? 0;
    p.waveFreq = opts.waveFreq ?? 9;
    p.cx = origin.x; p.cz = origin.z;
    p.perpX = -p.dirZ; p.perpZ = p.dirX; // Senkrechte zur Flugrichtung
    // bounce: verbleibende Abpraller an den Arena-Wänden
    p.bounces = opts.bounces ?? 0;
    // orbit: kreist um die Ente (Radius/Dauer/Winkel)
    p.orbitR = opts.orbitR ?? 0;
    p.orbitAng = opts.orbitAng ?? 0;
    p.orbitSpin = opts.orbitSpin ?? 3.4;
    // lob: Bogenwurf-Höhe (vertikale Geschwindigkeit + Schwerkraft)
    p.lob = !!opts.lob;
    p.py = 1.0; p.vy = opts.lobVy ?? 0;
    // blackhole: Sog-Radius/-Stärke
    p.pullR = opts.pullR ?? 0;
    p.pullForce = opts.pullForce ?? 0;
    // trefferbasierte Effekte (in game.js ausgewertet)
    p.explodeR = opts.explodeR ?? 0;
    p.explodeDmg = opts.explodeDmg ?? 0;
    p.splitN = opts.splitN ?? 0;
    p.chainN = opts.chainN ?? 0;
    p.chainRange = opts.chainRange ?? 0;
    p.fromSplit = !!opts.fromSplit;

    this.active.push(p);
    return p;
  }

  _spawnTrail(x, z, color, scale, y = 1.0) {
    let t = this.trailPool.pop();
    if (!t) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const spr = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 7), mat);
      t = { spr, life: 0, max: 0.3 };
      this.group.add(spr);
    }
    t.spr.material.color.setHex(color);
    t.spr.material.opacity = 0.72;
    t.spr.visible = true;
    t.spr.scale.setScalar(scale * 1.05);
    t.spr.position.set(x, y, z);
    t.life = t.max;
    this.trails.push(t);
  }

  // Nächster lebender Gegner zu (x,z) innerhalb range; ignoriert ein Set.
  _nearestEnemy(enemies, x, z, range, ignore) {
    let best = null, bd = range;
    for (const e of enemies) {
      if (!e.alive || !e.visible) continue;
      if (ignore && ignore.has(e)) continue;
      const d = Math.hypot(x - e.mesh.position.x, z - e.mesh.position.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ctx = { enemies, playerPos, arenaHalf } (alle optional).
  update(dt, ctx = {}) {
    const enemies = ctx.enemies || [];
    const pp = ctx.playerPos;
    const half = ctx.arenaHalf ?? BOUND;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      p.age += dt;
      let retired = false;

      switch (p.behavior) {
        case "homing": {
          const tgt = this._nearestEnemy(enemies, p.mesh.position.x, p.mesh.position.z, 60, null);
          if (tgt) {
            const want = Math.atan2(tgt.mesh.position.x - p.mesh.position.x, tgt.mesh.position.z - p.mesh.position.z);
            const cur = Math.atan2(p.vel.x, p.vel.z);
            let d = want - cur;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const step = Math.max(-p.homingRate * dt, Math.min(p.homingRate * dt, d));
            const na = cur + step;
            p.vel.set(Math.sin(na), 0, Math.cos(na)).multiplyScalar(p.speed);
          }
          p.mesh.position.x += p.vel.x * dt;
          p.mesh.position.z += p.vel.z * dt;
          break;
        }
        case "boomerang": {
          if (!p.returning && p.age >= p.outTime) { p.returning = true; p.hits.clear(); }
          if (p.returning && pp) {
            const want = Math.atan2(pp.x - p.mesh.position.x, pp.z - p.mesh.position.z);
            p.vel.set(Math.sin(want), 0, Math.cos(want)).multiplyScalar(p.speed);
            if (Math.hypot(pp.x - p.mesh.position.x, pp.z - p.mesh.position.z) < 1.4) { this.retire(i); retired = true; }
          }
          if (!retired) { p.mesh.position.x += p.vel.x * dt; p.mesh.position.z += p.vel.z * dt; }
          break;
        }
        case "wave": {
          p.cx += p.vel.x * dt;
          p.cz += p.vel.z * dt;
          const off = Math.sin(p.age * p.waveFreq) * p.waveAmp;
          p.mesh.position.x = p.cx + p.perpX * off;
          p.mesh.position.z = p.cz + p.perpZ * off;
          break;
        }
        case "bounce": {
          p.mesh.position.x += p.vel.x * dt;
          p.mesh.position.z += p.vel.z * dt;
          const lim = half - 0.5;
          if (p.mesh.position.x > lim || p.mesh.position.x < -lim) {
            p.vel.x *= -1; p.mesh.position.x = Math.max(-lim, Math.min(lim, p.mesh.position.x));
            if (--p.bounces < 0) { this.retire(i); retired = true; } else p.hits.clear();
          }
          if (!retired && (p.mesh.position.z > lim || p.mesh.position.z < -lim)) {
            p.vel.z *= -1; p.mesh.position.z = Math.max(-lim, Math.min(lim, p.mesh.position.z));
            if (--p.bounces < 0) { this.retire(i); retired = true; } else p.hits.clear();
          }
          break;
        }
        case "orbit": {
          if (pp) {
            p.orbitAng += p.orbitSpin * dt;
            p.mesh.position.x = pp.x + Math.cos(p.orbitAng) * p.orbitR;
            p.mesh.position.z = pp.z + Math.sin(p.orbitAng) * p.orbitR;
            // Tangential-Geschwindigkeit (nur für Optik/Ausrichtung)
          }
          break;
        }
        case "lob": {
          p.mesh.position.x += p.vel.x * dt;
          p.mesh.position.z += p.vel.z * dt;
          p.vy -= 26 * dt;
          p.py += p.vy * dt;
          if (p.py <= 1.0) {
            // gelandet → Explosion melden, dann verschwinden
            if (ctx.onArea && p.explodeR) ctx.onArea(p.mesh.position.x, p.mesh.position.z, p.explodeR, p.explodeDmg || p.damage, p.color);
            this.retire(i); retired = true;
          }
          break;
        }
        case "blackhole": {
          p.mesh.position.x += p.vel.x * dt;
          p.mesh.position.z += p.vel.z * dt;
          // Gegner im Radius leicht zur Singularität ziehen.
          if (p.pullR) {
            for (const e of enemies) {
              if (!e.alive || !e.visible || e.def?.isBoss) continue;
              const ex = p.mesh.position.x - e.mesh.position.x;
              const ez = p.mesh.position.z - e.mesh.position.z;
              const d = Math.hypot(ex, ez);
              if (d < p.pullR && d > 0.1) {
                const k = Math.min(1, (p.pullForce * dt) / d);
                e.mesh.position.x += ex * k;
                e.mesh.position.z += ez * k;
              }
            }
          }
          if (p.life <= 0 && ctx.onArea && p.explodeR) {
            ctx.onArea(p.mesh.position.x, p.mesh.position.z, p.explodeR, p.explodeDmg || p.damage, p.color);
          }
          break;
        }
        default: {
          p.mesh.position.x += p.vel.x * dt;
          p.mesh.position.z += p.vel.z * dt;
        }
      }
      if (retired) continue;

      // Höhe (Lob bogt, sonst flach).
      const y = p.lob ? p.py : 1.0;
      p.mesh.position.y = y;

      // Drehende Stile (Säge/Stern) rotieren um die Hochachse.
      if (p.spin) p.mesh.rotation.y += p.spin * dt;
      // Ausgerichtete Stile entlang aktueller Flugrichtung halten.
      if (p.align) p.mesh.rotation.y = Math.atan2(p.vel.x, p.vel.z);

      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.018;
        this._spawnTrail(p.mesh.position.x, p.mesh.position.z, p.color, p.mesh.scale.x, y);
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

// Weicher radialer Glow-Sprite für Geschosse (additiv).
function makeProjGlow() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
