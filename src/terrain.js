// Verticality: begehbare Plattformen & Treppenstufen.
// heightAt(x,z) liefert die Bodenhöhe – Spieler und Gegner folgen ihr.
import * as THREE from "three";

export class Terrain {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.platforms = []; // {minX,maxX,minZ,maxZ,top}
    this._build();
  }

  _build() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b2233, roughness: 0.75, metalness: 0.2,
    });
    const edgeColor = 0x6ee7ff;

    // Rechte Treppe hoch zu einem Plateau.
    const steps = [
      { cx: 10, cz: -2, w: 5, d: 12, top: 1.0 },
      { cx: 13.5, cz: -2, w: 3, d: 12, top: 2.2 },
      { cx: 17, cz: -2, w: 6, d: 14, top: 3.4 }, // Plateau rechts
    ];
    for (const s of steps) this._add(s.cx, s.cz, s.w, s.d, s.top, mat, edgeColor);

    // Linke Treppe zu einem hohen Plateau.
    this._add(-10, 8, 6, 5, 1.2, mat, edgeColor);
    this._add(-14, 8, 4, 5, 2.4, mat, edgeColor);
    this._add(-18, 8, 6, 8, 3.8, mat, edgeColor); // höchste Etage

    // Weitere Blöcke.
    this._add(-8, -13, 8, 6, 1.6, mat, edgeColor);
    this._add(5, 17, 7, 5, 1.0, mat, edgeColor);
  }

  _add(cx, cz, w, d, top, mat, edgeColor) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, top, d), mat);
    box.position.set(cx, top / 2, cz);
    box.castShadow = true;
    box.receiveShadow = true;
    this.group.add(box);

    // Leuchtende Oberkante (Stufe gut erkennbar).
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.25, 0.12, d + 0.25),
      new THREE.MeshBasicMaterial({ color: edgeColor })
    );
    lip.position.set(cx, top + 0.06, cz);
    this.group.add(lip);

    this.platforms.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2, top,
    });
  }

  // Höchste Plattform-Oberkante unter (x,z), sonst 0 (Boden).
  heightAt(x, z) {
    let h = 0;
    for (const p of this.platforms) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && p.top > h) {
        h = p.top;
      }
    }
    return h;
  }
}
