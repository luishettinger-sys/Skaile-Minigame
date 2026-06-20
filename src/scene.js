// 3D-Welt: Renderer, Szene, Kamera, Licht, Arena (Code-Grid), Kamera-Rig.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { damp } from "./utils.js";
import { buildOffice, applyDeskTexture, buildBackdrop } from "./environment.js";
import { Terrain } from "./terrain.js";

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.bg);
  scene.fog = new THREE.Fog(CONFIG.colors.fog, 38, 95);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(0, CONFIG.camera.offset.y, CONFIG.camera.offset.z);
  camera.lookAt(0, 0, 0);

  // --- Licht -----------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0x8aa0ff, 0x05060a, 0.75);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(14, 34, 16);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x6ee7ff, 0.5);
  rim.position.set(-18, 12, -14);
  scene.add(rim);

  // --- Arena -----------------------------------------------------------------
  const half = CONFIG.arena.half;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, half * 2),
    new THREE.MeshStandardMaterial({
      color: CONFIG.colors.floor,
      metalness: 0.25,
      roughness: 0.82,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  applyDeskTexture(floor.material); // AI-Desk-Mat, sobald vorhanden

  // Office-Kulisse rund um die Arena + umlaufender Hintergrund.
  buildOffice(scene);
  buildBackdrop(scene);

  // Begehbare Plattformen / Stufen.
  const terrain = new Terrain(scene);

  const grid = new THREE.GridHelper(
    half * 2,
    CONFIG.arena.grid,
    CONFIG.colors.gridMain,
    CONFIG.colors.gridSub
  );
  grid.position.y = 0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);

  const border = makeBorder(half);
  scene.add(border);

  // --- Kamera-Rig (Follow + Screenshake) -------------------------------------
  const focus = new THREE.Vector3(0, 0, 0); // worauf die Kamera schaut
  let shake = 0;
  let camT = 0;

  function updateCamera(targetPos, dt) {
    camT += dt;
    focus.x = damp(focus.x, targetPos.x, CONFIG.camera.followLerp, dt);
    focus.z = damp(focus.z, targetPos.z, CONFIG.camera.followLerp, dt);
    focus.y = damp(focus.y, targetPos.y || 0, CONFIG.camera.followLerp, dt);

    const o = CONFIG.camera.offset;
    const hover = Math.sin(camT * CONFIG.camera.hoverSpeed) * CONFIG.camera.hover;
    camera.position.set(focus.x + o.x, o.y + focus.y + hover, focus.z + o.z);

    if (shake > 0.0001) {
      shake = Math.max(0, shake - dt * 1.6);
      const s = shake * shake; // quadratisch → spürbarer Punch, schnelles Abklingen
      camera.position.x += (Math.random() - 0.5) * s * 6;
      camera.position.y += (Math.random() - 0.5) * s * 4;
      camera.position.z += (Math.random() - 0.5) * s * 6;
    }
    camera.lookAt(focus.x, focus.y, focus.z);
  }

  function addShake(amount) {
    shake = Math.min(1, shake + amount);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize);

  const api = {
    renderer, scene, camera, updateCamera, addShake, resize,
    arenaHalf: half,
    terrain,
  };

  // Arena wächst: Boden, Grid und Rahmen mitskalieren.
  api.setArena = (h) => {
    const s = h / half;
    floor.scale.set(s, s, 1); // Plane ist gedreht → x,y ⇒ Welt-x,z
    grid.scale.set(s, 1, s);
    border.scale.set(s, 1, s);
    api.arenaHalf = h;
  };

  return api;
}

// Leuchtender Neon-Rahmen rund um die Arena.
function makeBorder(half) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.border });
  const t = 0.35; // Dicke
  const h = 0.6; // Höhe
  const len = half * 2 + t;
  const sides = [
    [0, half, 0], // hinten
    [0, -half, 0], // vorne
  ];
  for (const [x, z] of sides) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, h, t), mat);
    bar.position.set(x, h / 2, z);
    group.add(bar);
  }
  for (const z of [0]) {
    const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, len), mat);
    left.position.set(-half, h / 2, z);
    group.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(t, h, len), mat);
    right.position.set(half, h / 2, z);
    group.add(right);
  }
  return group;
}
