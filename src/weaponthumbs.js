// Rendert pro Waffe ein kleines Thumbnail (aus dem 3D-Modell) als PNG-DataURL,
// für die Markt-/Shop-Karten. Lazy + gecacht; ein eigener kleiner Offscreen-Renderer.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { cloneWeaponModel } from "./weaponmodels.js";

const cache = {};
let renderer = null, scene = null, cam = null;

function ensure() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(160, 160);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35; // heller → Waffen klar erkennbar
  scene = new THREE.Scene();
  // Environment-Map: metallische Waffen reflektieren sie → sie wirken nicht mehr
  // schwarz/dunkel, sondern bekommen helle Reflexe (war die Hauptursache).
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(2.5, 4, 3); scene.add(d);
  const d2 = new THREE.DirectionalLight(0xbfd4ff, 0.8); d2.position.set(-3, 1.5, -2); scene.add(d2);
  const d3 = new THREE.DirectionalLight(0xffffff, 0.7); d3.position.set(0, 1, 4); scene.add(d3); // Front-Aufheller
  cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
}

// Liefert eine PNG-DataURL des Waffenmodells (oder null, wenn kein Modell da ist).
export function weaponThumb(id) {
  if (id in cache) return cache[id];
  const m = cloneWeaponModel(id);
  if (!m) { cache[id] = null; return null; }
  try {
    ensure();
    const box = new THREE.Box3().setFromObject(m);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    m.position.sub(center);
    const grp = new THREE.Group(); grp.add(m);
    grp.rotation.set(0.35, -0.7, 0); // leichte 3/4-Ansicht
    scene.add(grp);
    const r = Math.max(size.x, size.y, size.z) || 1;
    cam.position.set(0, r * 0.25, r * 2.3); cam.lookAt(0, 0, 0);
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL("image/png");
    scene.remove(grp);
    cache[id] = url;
    return url;
  } catch (e) {
    cache[id] = null;
    return null;
  }
}
