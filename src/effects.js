// Partikel-Bursts & expandierende Schockwellen — der visuelle "Juice".
import * as THREE from "three";

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.particles = [];
    this.partPool = [];

    this.ringGeo = new THREE.RingGeometry(0.9, 1.0, 32);
    this.rings = [];
    this.ringPool = [];

    // Helle additive Blitze (Mündungsfeuer, Treffer-Funken) – Fake-Bloom ohne Post.
    this.flashTex = makeGlowTexture();
    this.flashes = [];
    this.flashPool = [];
  }

  // Heller, kurz aufblitzender additiver Sprite (z.B. Mündung oder Einschlag).
  flash(x, y, z, color = 0xffffff, size = 2, life = 0.09) {
    let f = this.flashPool.pop();
    if (!f) {
      const mat = new THREE.SpriteMaterial({ map: this.flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const spr = new THREE.Sprite(mat);
      this.group.add(spr);
      f = { spr };
    }
    f.spr.visible = true;
    f.spr.material.color.setHex(color);
    f.spr.material.opacity = 1;
    f.spr.position.set(x, y, z);
    f.spr.scale.setScalar(size);
    f.size = size; f.life = f.max = life;
    this.flashes.push(f);
  }

  // Partikel-Explosion an (x,z).
  burst(x, z, color, count = 14, power = 1) {
    for (let i = 0; i < count; i++) {
      let p = this.partPool.pop();
      if (!p) {
        const mat = new THREE.MeshBasicMaterial({ transparent: true });
        const mesh = new THREE.Mesh(this.geo, mat);
        p = { mesh, vel: new THREE.Vector3(), life: 0, max: 1 };
        this.group.add(mesh);
      }
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.position.set(x, 0.8, z);
      p.mesh.scale.setScalar(1);
      const ang = Math.random() * Math.PI * 2;
      const sp = (3 + Math.random() * 6) * power;
      p.vel.set(Math.cos(ang) * sp, 4 + Math.random() * 5, Math.sin(ang) * sp);
      p.life = p.max = 0.5 + Math.random() * 0.4;
      this.particles.push(p);
    }
  }

  // Expandierender Ring (Treffer / Ultimate-Welle).
  shockwave(x, z, color, maxR = 6, speed = 14) {
    let r = this.ringPool.pop();
    if (!r) {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      r = { mesh };
      this.group.add(mesh);
    }
    r.mesh.visible = true;
    r.mesh.material.color.setHex(color);
    r.mesh.material.opacity = 0.9;
    r.mesh.position.set(x, 0.1, z);
    r.mesh.scale.setScalar(0.5);
    r.maxR = maxR;
    r.speed = speed;
    this.rings.push(r);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 22 * dt; // Gravitation
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.vel.y *= -0.4;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      const t = Math.max(0, p.life / p.max);
      p.mesh.material.opacity = t;
      p.mesh.scale.setScalar(t * 1.1 + 0.1);
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particles.splice(i, 1);
        this.partPool.push(p);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      const s = r.mesh.scale.x + r.speed * dt;
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = Math.max(0, 0.9 * (1 - s / r.maxR));
      if (s >= r.maxR) {
        r.mesh.visible = false;
        this.rings.splice(i, 1);
        this.ringPool.push(r);
      }
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      const t = Math.max(0, f.life / f.max);
      f.spr.material.opacity = t;
      f.spr.scale.setScalar(f.size * (1.7 - t * 0.7)); // leicht expandieren beim Faden
      if (f.life <= 0) {
        f.spr.visible = false;
        this.flashes.splice(i, 1);
        this.flashPool.push(f);
      }
    }
  }

  reset() {
    for (const p of this.particles) { p.mesh.visible = false; this.partPool.push(p); }
    for (const r of this.rings) { r.mesh.visible = false; this.ringPool.push(r); }
    for (const f of this.flashes) { f.spr.visible = false; this.flashPool.push(f); }
    this.particles = [];
    this.rings = [];
    this.flashes = [];
  }
}

// Weicher radialer Glüh-Sprite (weiß → transparent) für additive Blitze.
function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.75)");
  g.addColorStop(0.6, "rgba(255,255,255,0.22)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
