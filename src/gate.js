// Verteidigungs-Tor: ein Holzzaun am Durchgang zum PC-Raum. Die Bug-Monster wollen
// hindurch, um den PC + die Webseite zu fressen. Fällt das Tor (HP 0), ist der Run vorbei.
// Coins können es später reparieren/aufrüsten (HP, Geschütze).
import * as THREE from "three";

export class Gate {
  constructor(scene, x, z, opts = {}) {
    this.x = x; this.z = z;
    this.width = opts.width ?? 11;
    this.maxHp = opts.maxHp ?? 320;
    this.hp = this.maxHp;
    this.r = opts.r ?? 3.6;     // Reichweite, in der Monster das Tor anknabbern
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._flash = 0;
    this._build();
  }

  _build() {
    const g = this.group;
    this.woodA = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.92, metalness: 0.0 });
    this.woodB = new THREE.MeshStandardMaterial({ color: 0x5e3d20, roughness: 0.92, metalness: 0.0 });
    const n = Math.max(3, Math.round(this.width / 1.4));
    for (let i = 0; i <= n; i++) {
      const px = -this.width / 2 + (this.width * i) / n;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 2.6, 0.36), this.woodA);
      post.position.set(px, 1.3, 0);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 4), this.woodB);
      tip.position.set(px, 2.8, 0); tip.rotation.y = Math.PI / 4;
      g.add(post, tip);
    }
    for (const y of [1.0, 1.95]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(this.width, 0.3, 0.18), this.woodB);
      rail.position.set(0, y, 0); g.add(rail);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // HP-Balken (flach über dem Tor, aus der Vogelperspektive gut sichtbar).
    this._barW = this.width;
    this._barBg = new THREE.Mesh(new THREE.BoxGeometry(this._barW + 0.3, 0.12, 0.74),
      new THREE.MeshBasicMaterial({ color: 0x0c1118 }));
    this._barBg.position.set(0, 3.5, 0);
    this._barFill = new THREE.Mesh(new THREE.BoxGeometry(this._barW, 0.16, 0.52),
      new THREE.MeshBasicMaterial({ color: 0x39ff9a }));
    this._barFill.position.set(0, 3.6, 0);
    g.add(this._barBg, this._barFill);

    g.position.set(this.x, 0, this.z);
  }

  get alive() { return this.hp > 0; }

  // Schaden nehmen; gibt true zurück, wenn das Tor dadurch zerstört wird.
  damage(amount) {
    if (this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this._flash = 1;
    return this.hp <= 0;
  }

  repair(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  setMaxHp(v) { const r = this.maxHp > 0 ? this.hp / this.maxHp : 1; this.maxHp = v; this.hp = Math.min(v, v * r + 0.0001); }

  update(dt) {
    const ratio = Math.max(0, this.hp / this.maxHp);
    this._barFill.scale.x = Math.max(0.001, ratio);
    this._barFill.position.x = -this._barW / 2 + (this._barW * ratio) / 2;
    this._barFill.material.color.setHex(ratio > 0.5 ? 0x39ff9a : ratio > 0.25 ? 0xffd23f : 0xff5470);

    // Treffer-Blitz: Holz kurz rot glühen lassen.
    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 4);
      const f = this._flash * 0.6;
      this.woodA.emissive.setRGB(f, f * 0.1, 0);
      this.woodB.emissive.setRGB(f, f * 0.1, 0);
    }
    // Sichtbar einsacken, wenn zerstört.
    this.group.scale.y = this.hp <= 0 ? 0.25 : 1;
  }

  reset() {
    this.hp = this.maxHp;
    this._flash = 0;
    this.group.scale.y = 1;
    this.group.visible = true;
  }
}
