// Weiche Cartoon-Bodenschatten (Cult-of-the-Lamb-Look): eine flache Ellipse mit
// radialem Verlauf statt realistischem Schattenwurf. Erdet Figuren visuell und
// passt zum flachen, gemalten Stil. Geteilte Textur → praktisch gratis.
import * as THREE from "three";

let _tex = null;
function blobTexture() {
  if (_tex) return _tex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0.0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.55, "rgba(0,0,0,0.34)");
  g.addColorStop(1.0, "rgba(0,0,0,0.0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  _tex = new THREE.CanvasTexture(c);
  _tex.colorSpace = THREE.SRGBColorSpace;
  return _tex;
}

// Flacher Schatten-Mesh mit Radius (in Welt-Einheiten). Liegt waagerecht.
export function makeBlob(radius = 1, opacity = 0.9) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2.6, radius * 2.6),
    new THREE.MeshBasicMaterial({
      map: blobTexture(),
      transparent: true,
      depthWrite: false,
      opacity,
      toneMapped: false, // bleibt dunkel, unabhängig vom Tonemapping
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  m.renderOrder = -1; // unter allem zeichnen
  return m;
}
