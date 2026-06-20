// 3D-Welt: Renderer, Szene, Kamera, Licht, Arena (Code-Grid), Kamera-Rig.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { CONFIG } from "./config.js";
import { damp } from "./utils.js";
import { buildOffice, applyDeskTexture, buildBackdrop, setBackdropTexture } from "./environment.js";
import { Terrain } from "./terrain.js";

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
  key.position.set(14, 38, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 130;
  key.shadow.camera.left = -55;
  key.shadow.camera.right = 55;
  key.shadow.camera.top = 55;
  key.shadow.camera.bottom = -55;
  key.shadow.bias = -0.0004;
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
  const backdrop = buildBackdrop(scene);

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

  // Dynamische Kamera-Perspektive: aktueller Versatz blendet zum Ziel-Versatz.
  const baseOffset = { ...CONFIG.camera.offset };
  const curOffset = { ...baseOffset };
  let targetOffset = { ...baseOffset };

  function updateCamera(targetPos, dt) {
    camT += dt;
    focus.x = damp(focus.x, targetPos.x, CONFIG.camera.followLerp, dt);
    focus.z = damp(focus.z, targetPos.z, CONFIG.camera.followLerp, dt);
    focus.y = damp(focus.y, targetPos.y || 0, CONFIG.camera.followLerp, dt);

    // Perspektive sanft überblenden.
    curOffset.x = damp(curOffset.x, targetOffset.x, 2.6, dt);
    curOffset.y = damp(curOffset.y, targetOffset.y, 2.6, dt);
    curOffset.z = damp(curOffset.z, targetOffset.z, 2.6, dt);

    const o = curOffset;
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

  // --- Post-Processing: Bloom für leuchtende Geschosse/Neon/Monitor ---------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.75, // strength
    0.5, // radius
    0.82 // threshold (nur Helles glüht)
  );
  composer.addPass(bloom);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize);

  const api = {
    renderer, scene, camera, updateCamera, addShake, resize,
    arenaHalf: half,
    terrain,
  };

  // Kamera-Perspektive setzen / zurücksetzen (sanfte Überblendung).
  api.setCamera = (off) => {
    targetOffset = {
      x: off.x ?? baseOffset.x,
      y: off.y ?? baseOffset.y,
      z: off.z ?? baseOffset.z,
    };
  };
  api.resetCamera = () => { targetOffset = { ...baseOffset }; };
  api.setBackdrop = (url) => setBackdropTexture(backdrop, url);
  api.render = () => composer.render();

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
