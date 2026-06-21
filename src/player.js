// Die Helden-Gummiente: Movement, HP, Waddle-Animation.
// Platzhalter-Mesh aus Primitiven; setModel() tauscht später das AI-GLB rein.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { damp } from "./utils.js";
import { loadSkinTexture } from "./skins.js";
import { makeBlob } from "./shadowblob.js";

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.placeholder = buildDuck();
    this.root.add(this.placeholder);
    this.model = null; // wird durch setModel() gefüllt

    this.pos = this.root.position;
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.phase = 0;

    this.maxHp = CONFIG.player.maxHp;
    this.hp = this.maxHp;
    this.invuln = 0;
    this.alive = true;

    this.dashTimer = 0; // verbleibende Dash-Dauer
    this.dashCD = 0; // verbleibender Cooldown
    this.lastDir = { x: 0, z: 1 }; // Richtung für Dash im Stand
    this.arenaHalf = CONFIG.arena.half; // wächst mit der Arena
    this.cosmetics = { helmet: null, shades: null, cape: null };
    this.terrain = null; // wird von Game gesetzt (Höhen-Sampling)

    // Weicher Cartoon-Bodenschatten (CotL-Look), separat auf Bodenhöhe geführt
    // (nicht als Kind der Ente, damit Squash/Stretch ihn nicht verzerrt).
    this.shadow = makeBlob(1.05, 0.92);
    scene.add(this.shadow);

    // Hero-Markierung: hebt den Maincharacter klar vom Boden, von Bugs, Coins
    // und XP-Gems ab. Warmer Unter-Glow + kühler, pulsierender Kontrast-Ring.
    this.baseScale = 1.12; // einen Tick größer → mehr Präsenz
    this.smoothVel = new THREE.Vector3();
    this._t = 0;
    this.hero = buildHeroRing();
    scene.add(this.hero.group);

    // Speed-Trail (nachziehende Schemen beim Dash).
    this._trail = [];
    this._trailPool = [];
    this._trailT = 0;

    // Persönlichkeit/Show: Aura-Funken, Idle-Einlage (Hüpfer), Auftritts-Pop.
    this._sparks = [];
    this._sparkPool = [];
    this._sparkT = 0;
    this._idle = 0;
    this._flourish = 0;
    this._pop = 0;
  }

  // Dash auslösen (Ausweichen mit i-Frames). Gibt true zurück, wenn erfolgreich.
  tryDash(cooldown) {
    if (this.dashCD > 0 || !this.alive) return false;
    this.dashTimer = CONFIG.player.dash.duration;
    this.dashCD = cooldown;
    this.invuln = Math.max(this.invuln, CONFIG.player.dash.iframes);
    return true;
  }

  update(dt, move, moveSpeed = CONFIG.player.speed) {
    if (this.dashCD > 0) this.dashCD = Math.max(0, this.dashCD - dt);

    let speed = moveSpeed;
    const dashing = this.dashTimer > 0;
    if (dashing) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      speed *= CONFIG.player.dash.mult;
    }
    if (move.x !== 0 || move.z !== 0) this.lastDir = { x: move.x, z: move.z };
    // Im Stand nur während eines Dash in die letzte Richtung gleiten.
    const dir =
      move.x !== 0 || move.z !== 0 ? move : dashing ? this.lastDir : { x: 0, z: 0 };
    this.vel.set(dir.x * speed, 0, dir.z * speed);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // Kollision mit den Gebäudewänden (Kreis vs. Wand-AABBs).
    if (this.terrain && this.terrain.resolveMove) {
      const r = this.terrain.resolveMove(this.pos.x, this.pos.z, CONFIG.player.radius);
      this.pos.x = r.x;
      this.pos.z = r.z;
    }

    // Blickrichtung wird extern via Maus-Zielen gesetzt (this.facing).
    const moving = move.x !== 0 || move.z !== 0;
    this._t += dt;
    this.root.rotation.y = this.facing;

    // Geglättete Geschwindigkeit (nur für die Optik) → die Ente lehnt sich weich
    // in Lauf-/Strafe-Richtung statt hart umzuspringen. Steuerung bleibt direkt.
    const sm = 1 - Math.exp(-10 * dt);
    this.smoothVel.x += (this.vel.x - this.smoothVel.x) * sm;
    this.smoothVel.z += (this.vel.z - this.smoothVel.z) * sm;

    // Bewegung in den lokalen Achsen der Ente (relativ zur Blickrichtung):
    // forward = Lauf nach vorn/hinten, right = seitliches Straffen.
    const sf = Math.sin(this.facing), cf = Math.cos(this.facing);
    const ref = Math.max(1, (moveSpeed || 1) * CONFIG.player.dash.mult);
    const fwdL = (this.smoothVel.x * sf + this.smoothVel.z * cf) / ref;
    const rgtL = (this.smoothVel.x * cf - this.smoothVel.z * sf) / ref;

    // Bodenhöhe (für Hop, Schatten, Funken).
    const groundY = this.terrain ? this.terrain.heightAt(this.pos.x, this.pos.z) : 0;

    // Idle-Show: steht die Ente länger still, macht sie ab und zu einen kleinen
    // Hüpfer (Persönlichkeit). Auftritts-Pop (_pop) klingt nach Run-Start ab.
    if (moving || dashing) this._idle = 0; else this._idle += dt;
    if (this._idle > 3.5 && this._flourish <= 0) { this._flourish = 0.6; this._idle = 0; this._burstSparks(6, groundY); }
    if (this._flourish > 0) this._flourish = Math.max(0, this._flourish - dt);
    if (this._pop > 0) this._pop = Math.max(0, this._pop - dt * 2.6);
    const flo = this._flourish > 0 ? Math.sin((1 - this._flourish / 0.6) * Math.PI) : 0; // 0→1→0

    // Lebendige Bewegung: kräftiges Waddle, Bob/Hop, Lean/Banking, Squash&Stretch.
    this.phase += dt * (moving ? 17 : 3.2);
    const swing = Math.sin(this.phase);
    const hop = (moving ? Math.abs(swing) * 0.30 : Math.abs(swing) * 0.05) + flo * 0.5; // + Idle-Hüpfer

    if (this.mixer) {
      // Lauf-Animation (Beine watscheln mit): Tempo skaliert mit der Bewegung,
      // im Stand fast eingefroren (kein Watscheln auf der Stelle).
      this.mixer.update(dt * (moving || dashing ? 1.7 : 0.05));
    } else {
      const waddle = moving ? 0.30 : 0.04; // stärkeres Wackeln als zuvor
      // Waddle + Banking ins Straffen + fröhliches Wackeln während der Einlage.
      this.root.rotation.z = swing * waddle - rgtL * 0.6 + Math.sin(this._t * 34) * flo * 0.18;
      this.root.rotation.x = fwdL * 0.3 + (moving ? 0.06 : Math.sin(this._t * 1.6) * 0.02);
      let squash = 1 - Math.abs(swing) * (moving ? 0.13 : 0.025);
      let stretch = 1 / Math.sqrt(squash);
      let sx = stretch, sy = squash, sz = stretch;
      if (dashing) { sz *= 1.28; sx *= 0.88; sy *= 0.9; } // in Flugrichtung strecken
      const B = this.baseScale * (1 + this._pop * 0.4 + flo * 0.1); // Auftritts-Pop + Einlage
      this.root.scale.set(sx * B, sy * B, sz * B);
    }

    // Höhe: auf Plattformen/Stufen steigen (weich nachziehen) + Hop.
    const targetY = groundY + hop;
    this.pos.y += (targetY - this.pos.y) * (1 - Math.exp(-14 * dt));

    // Bodenschatten flach unter der Ente halten (folgt x/z + Bodenhöhe).
    if (this.shadow) {
      this.shadow.position.set(this.pos.x, groundY + 0.06, this.pos.z);
      const s = 1 - Math.min(0.3, hop * 0.8);
      this.shadow.scale.set(s, s, s);
    }

    // Hero-Markierung + Speed-Trail aktualisieren.
    this._updateHero(dt, groundY, moving, dashing);
    if (dashing) this._emitTrail(groundY);
    this._updateTrail(dt);

    // Aura-Funken: sparsam aufsteigende Glitzer um die Ente (mehr Präsenz).
    this._sparkT -= dt;
    if (this._sparkT <= 0) { this._sparkT = 0.34; this._spawnSpark(groundY); }
    this._updateSparks(dt);

    // Waffen-Rückstoß abklingen lassen (Wucht beim Schießen).
    if (this.weaponModel) {
      this._kick = Math.max(0, (this._kick || 0) - dt * 9);
      const k = this._kick;
      this.weaponModel.position.z = -0.16 * k;
      this.weaponModel.rotation.x = 0.32 * k;
    }

    // Unverwundbarkeit + Blink-Feedback.
    if (this.invuln > 0) {
      this.invuln = Math.max(0, this.invuln - dt);
      const blink = Math.sin(this.invuln * 40) > 0;
      this._setVisible(blink || this.invuln === 0);
    }
  }

  takeDamage(amount) {
    if (this.invuln > 0 || !this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = CONFIG.player.hitInvuln;
    if (this.hp <= 0) {
      this.alive = false;
    }
    return true;
  }

  // --- Kosmetik (freischaltbar) --------------------------------------------
  addHelmet() {
    if (this.cosmetics.helmet) return false;
    // Dezent: kleine flache Kappe, die knapp auf dem Scheitel sitzt (misst die
    // echte Modellhöhe, schwebt also nicht). Verdeckt die Ente nicht.
    const top = this.duckTopY || 1.9;
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.4, metalness: 0.35 });
    const g = new THREE.Group();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), mat
    );
    g.add(dome);
    g.position.set(0, top - 0.12, 0.08); // knapp auf dem Kopf, minimal nach vorn
    this.cosmetics.helmet = g;
    this.root.add(g);
    return true;
  }

  // Zusatz-Brille entfernt: Das Enten-Modell hat bereits eine Brille; die alte
  // prozedurale Brille saß an Platzhalter-Koordinaten und schwebte vor dem Modell
  // (verdeckte die Waffe). Bleibt als No-op, damit Unlock-Banner weiter feuern.
  addShades() {
    return true;
  }

  addCape() {
    if (this.cosmetics.cape) return false;
    // Dezent: kurzes Cape eng am Rücken, halbtransparent → Ente bleibt erkennbar.
    const top = this.duckTopY || 1.9;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff5470, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.82,
    });
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.85, top * 0.55), mat);
    cape.position.set(0, top * 0.5, -(this.duckDepth || 0.7) * 0.7);
    cape.rotation.x = 0.18;
    this.cosmetics.cape = cape;
    this.root.add(cape);
    return true;
  }

  // Aktives Gadget als kleines schwebendes Emoji-Symbol an der Ente.
  setGadget(icon) {
    if (this.gadgetSprite) { this.root.remove(this.gadgetSprite); this.gadgetSprite = null; }
    if (!icon) return;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    ctx.font = "96px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, 64, 72);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(1.1, 1.1, 1);
    spr.position.set(0, 2.8, -0.4);
    this.gadgetSprite = spr;
    this.root.add(spr);
  }

  _clearCosmetics() {
    for (const k of Object.keys(this.cosmetics)) {
      if (this.cosmetics[k]) this.root.remove(this.cosmetics[k]);
      this.cosmetics[k] = null;
    }
  }

  // Getragene Waffe: hängt ein normalisiertes GLB an die Ente.
  // obj === Klon aus cloneWeaponModel() oder null (entfernt die Waffe).
  setWeaponModel(obj) {
    // Alte Waffe entfernen (egal woran sie hing).
    if (this.weaponModel && this.weaponModel.parent) this.weaponModel.parent.remove(this.weaponModel);
    if (this.weaponModel && this.weaponModel !== obj) this.weaponModel = null;
    if (!obj) { this.weaponModel = null; return; }

    // Skalierung wird auf 1 zurückgesetzt, bevor die Box gemessen wird (Re-Attach).
    obj.scale.setScalar(1);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    const len = Math.max(size.x, size.y, size.z) || 1;
    const targetLen = 1.2; // handliche Welt-Größe

    if (this.handBone) {
      // An die rechte Hand hängen (folgt der Lauf-Animation). Die Bone trägt die
      // Modell-Skalierung → gegenrechnen, damit die Waffe Welt-Größe behält.
      const ws = new THREE.Vector3();
      this.handBone.getWorldScale(ws);
      const inv = 1 / (ws.x || 1);
      obj.scale.setScalar((targetLen / len) * inv);
      obj.position.set(0, 0, 0);
      obj.rotation.set(0, 0, 0);
      this.handBone.add(obj);
    } else {
      if (!this.weaponAnchor) {
        this.weaponAnchor = new THREE.Group();
        this.weaponAnchor.position.set(0.58, 0.78, 0.5);
        this.root.add(this.weaponAnchor);
      }
      obj.scale.setScalar(targetLen / len);
      obj.position.set(0, 0, 0);
      this.weaponAnchor.add(obj);
    }
    this.weaponModel = obj;
    this._kick = 0;
  }

  // Rückstoß auslösen (beim Schießen) – die Waffe ruckt kurz zurück.
  kickWeapon(amount = 1) {
    this._kick = Math.min(1.5, (this._kick || 0) + amount);
  }

  // Muzzle-Position für Projektile (leicht vor der Ente).
  muzzle() {
    return new THREE.Vector3(this.pos.x, 1.0, this.pos.z);
  }

  reset() {
    this.pos.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.facing = 0;
    this.maxHp = CONFIG.player.maxHp;
    this.hp = this.maxHp;
    this.invuln = 0;
    this.alive = true;
    this.dashTimer = 0;
    this.dashCD = 0;
    this.arenaHalf = CONFIG.arena.half;
    this._clearCosmetics();
    this.setGadget(null);
    this._setVisible(true);
    // Speed-Trail + Funken leeren.
    if (this._trail) {
      for (const p of this._trail) { p.visible = false; this._trailPool.push(p); }
      this._trail.length = 0;
    }
    if (this._sparks) {
      for (const s of this._sparks) { s.visible = false; this._sparkPool.push(s); }
      this._sparks.length = 0;
    }
    this.smoothVel?.set(0, 0, 0);
    // Auftritts-Pop: kleiner Scale-Punch + Funken-Burst beim Run-Start.
    this._idle = 0;
    this._flourish = 0;
    this._pop = 1;
    this._burstSparks(10, 0);
  }

  // Tauscht das Platzhalter-Mesh gegen ein geladenes GLB-Modell.
  // Spielt vorhandene Skelett-Animationen (gerigged) per Mixer ab.
  setModel(object3d) {
    if (this.model) this.root.remove(this.model);
    this.placeholder.visible = false;
    this.model = object3d;
    this.root.add(object3d);

    // Echte Modell-Maße merken → Accessoires sitzen am Kopf statt in der Luft.
    const box = new THREE.Box3().setFromObject(object3d);
    this.duckTopY = box.max.y || 1.9; // Scheitel
    this.duckDepth = box.max.z || 0.7; // Vorderkante (Blickrichtung +Z)

    const clips = object3d.userData.gltfAnimations || [];
    this._isRigged = clips.length > 0;
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(object3d);
      this.mixer.clipAction(clips[0]).play();
    } else {
      this.mixer = null;
    }

    // Rechte Hand-Bone finden → getragene Waffe hängt daran (folgt der Animation).
    this.handBone = null;
    object3d.traverse((o) => { if (o.isBone && o.name === "RightHand") this.handBone = o; });

    // Gebackene Skins gehören zu den UVs von duck.glb und passen NICHT auf das
    // gerigte Modell → beim gerigten Modell native Textur behalten (kein Skin-Tausch).
    if (this._skin && !this._isRigged) this.setSkin(this._skin);

    // Waffe (falls schon geladen) neu anhängen – jetzt ggf. an die Hand.
    if (this.weaponModel) this.setWeaponModel(this.weaponModel);
  }

  // Wendet einen Skin (recolorierte Albedo-Textur + Material-Props) auf das
  // geladene GLB an. def === Eintrag aus SKINS. Originalzustand wird gemerkt,
  // damit "classic" sauber zurücksetzt.
  setSkin(def) {
    this._skin = def;
    if (!this.model || !def) return;
    this.model.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.userData.skinOrig === undefined) {
          m.userData.skinOrig = {
            map: m.map || null,
            metalness: m.metalness ?? 0,
            roughness: m.roughness ?? 1,
            emissive: m.emissive ? m.emissive.getHex() : 0x000000,
            emissiveMap: m.emissiveMap || null,
            emissiveIntensity: m.emissiveIntensity ?? 1,
          };
        }
        const orig = m.userData.skinOrig;
        m.map = def.map ? loadSkinTexture(def.map) : orig.map;
        m.metalness = def.metalness ?? orig.metalness;
        m.roughness = def.roughness ?? orig.roughness;
        if (def.emissive != null) {
          m.emissive.setHex(def.emissive);
          m.emissiveIntensity = def.emissiveIntensity ?? 1;
          m.emissiveMap = def.emissiveFromMap ? m.map : orig.emissiveMap;
        } else {
          m.emissive.setHex(orig.emissive);
          m.emissiveIntensity = orig.emissiveIntensity;
          m.emissiveMap = orig.emissiveMap;
        }
        m.needsUpdate = true;
      }
    });
  }

  // Hero-Markierung: Unter-Glow + pulsierender, drehender Ring; flart beim Dash.
  _updateHero(dt, groundY, moving, dashing) {
    const h = this.hero;
    if (!h) return;
    h.group.position.set(this.pos.x, groundY + 0.05, this.pos.z);
    h.ring.rotation.z += dt * (dashing ? 6 : 1.4);
    const pulse = 1 + Math.sin(this._t * 4) * 0.06 + (moving ? 0.04 : 0);
    const flare = dashing ? 1.35 : 1;
    h.ring.scale.setScalar(pulse * flare);
    h.ring.material.opacity = (dashing ? 0.85 : 0.5) + Math.sin(this._t * 5) * 0.05;
    h.glow.material.opacity = (dashing ? 0.4 : 0.26) + Math.sin(this._t * 3) * 0.03;
    h.glow.scale.setScalar(flare);
  }

  // Speed-Trail: in Intervallen einen verblassenden Schemen am Boden hinterlassen.
  _emitTrail(groundY) {
    this._trailT -= 1 / 60;
    if (this._trailT > 0) return;
    this._trailT = 0.03;
    let p = this._trailPool.pop();
    if (!p) {
      p = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 20),
        new THREE.MeshBasicMaterial({
          map: glowTexture(), color: 0xffe08a, transparent: true,
          depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        })
      );
      p.rotation.x = -Math.PI / 2;
      this.scene.add(p);
    }
    p.position.set(this.pos.x, groundY + 0.08, this.pos.z);
    p.material.opacity = 0.5;
    p.scale.setScalar(1);
    p.visible = true;
    p.life = 0.32;
    this._trail.push(p);
  }

  _updateTrail(dt) {
    for (let i = this._trail.length - 1; i >= 0; i--) {
      const p = this._trail[i];
      p.life -= dt;
      p.material.opacity *= Math.exp(-9 * dt);
      p.scale.multiplyScalar(1 + dt * 1.6);
      if (p.life <= 0) {
        p.visible = false;
        this._trail.splice(i, 1);
        this._trailPool.push(p);
      }
    }
  }

  // --- Aura-Funken ---------------------------------------------------------
  _makeSpark() {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xffe9a8, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    this.scene.add(spr);
    return spr;
  }

  _spawnSpark(groundY, big = false) {
    let s = this._sparkPool.pop() || this._makeSpark();
    const a = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 0.9;
    s.position.set(this.pos.x + Math.cos(a) * r, groundY + 0.4 + Math.random() * 1.2, this.pos.z + Math.sin(a) * r);
    s.material.opacity = 0.9;
    const sc = (big ? 0.42 : 0.26) + Math.random() * 0.12;
    s.scale.setScalar(sc);
    s.visible = true;
    s.vy = 0.7 + Math.random() * 0.7;
    s.life = 0.6 + Math.random() * 0.4;
    this._sparks.push(s);
  }

  _burstSparks(n, groundY = 0) {
    for (let i = 0; i < n; i++) this._spawnSpark(groundY, true);
  }

  _updateSparks(dt) {
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const s = this._sparks[i];
      s.life -= dt;
      s.position.y += s.vy * dt;
      s.material.opacity *= Math.exp(-3.2 * dt);
      s.scale.multiplyScalar(1 - dt * 0.6);
      if (s.life <= 0) {
        s.visible = false;
        this._sparks.splice(i, 1);
        this._sparkPool.push(s);
      }
    }
  }

  _setVisible(v) {
    this.root.visible = v;
  }
}

// Platzhalter-Ente aus Primitiven (klassischer Quietsche-Enten-Look).
function buildDuck() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.duckBody, roughness: 0.45, metalness: 0.05,
  });
  const beakMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.duckBeak, roughness: 0.5,
  });
  const darkMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.duckEye });

  // Körper (Ellipsoid).
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 16), bodyMat);
  body.scale.set(1.1, 0.9, 1.3);
  body.position.y = 0.7;
  g.add(body);

  // Kopf.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), bodyMat);
  head.position.set(0, 1.45, 0.5);
  g.add(head);

  // Schnabel.
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 12), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.42, 1.05);
  g.add(beak);

  // Augen + Entwickler-Brille.
  for (const sx of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), darkMat);
    eye.position.set(sx, 1.55, 0.92);
    g.add(eye);
    const glasses = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.035, 8, 16),
      darkMat
    );
    glasses.position.set(sx, 1.55, 0.9);
    g.add(glasses);
  }

  // Schwänzchen.
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 10), bodyMat);
  tail.rotation.x = -Math.PI / 2.4;
  tail.position.set(0, 0.95, -1.15);
  g.add(tail);

  return g;
}

// Weiche, runde Glow-Textur (radial weiß → transparent) für Aura/Trail.
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

// Hero-Markierung am Boden: warmer Unter-Glow (passt zur goldenen Ente, hebt sie
// vom dunklen Boden) + kühler, kontrastreicher Ring (klar von Bugs/Coins/Gems
// unterscheidbar). Liegt waagerecht und wird der Ente nachgeführt.
function buildHeroRing() {
  const group = new THREE.Group();

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(2.0, 28),
    new THREE.MeshBasicMaterial({
      map: glowTexture(), color: 0xffd87a, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.01;
  glow.renderOrder = -1;
  group.add(glow);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.4, 40),
    new THREE.MeshBasicMaterial({
      color: 0x8ff0ff, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, toneMapped: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  return { group, glow, ring };
}
