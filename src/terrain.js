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

    // Treppe (steigende Stufen) hoch zu einem Plateau.
    const steps = [
      { cx: 9, cz: -2, w: 5, d: 11, top: 1.0 },
      { cx: 12.5, cz: -2, w: 3, d: 11, top: 2.0 },
      { cx: 16, cz: -2, w: 5, d: 13, top: 3.0 }, // Plateau
    ];
    for (const s of steps) this._add(s.cx, s.cz, s.w, s.d, s.top, mat, edgeColor);

    // Zweiter erhöhter Block auf der anderen Seite.
    this._add(-11, 9, 8, 8, 1.7, mat, edgeColor);
    this._add(-9, -10, 7, 6, 1.2, mat, edgeColor);
  }

  _add(cx, cz, w, d, top, mat, edgeColor) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, top, d), mat);
    box.position.set(cx, top / 2, cz);
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
