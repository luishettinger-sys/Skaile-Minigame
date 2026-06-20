// 3D-Welt: Renderer, Szene, Kamera, Licht, Arena (Code-Grid), Kamera-Rig.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CONFIG } from "./config.js";
import { damp } from "./utils.js";
import { buildOffice, buildBackdrop, setBackdropTexture } from "./environment.js";
import { buildOffice2 } from "./furnish.js";
import { Building } from "./building.js";
import { clamp } from "./utils.js";

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  // Pixelratio deckeln: auf Retina/4K spart das massiv GPU-Last → flüssiger.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.bg);
  scene.fog = new THREE.Fog(CONFIG.colors.fog, 38, 95);

  // Image-Based-Lighting: gibt allen PBR-Materialien Reflexionen → „echt"
  // statt flach. Erzeugt aus einer prozeduralen Raum-Umgebung.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(0, CONFIG.camera.offset.y, CONFIG.camera.offset.z);
  camera.lookAt(0, 0, 0);

  // --- Licht (Cult-of-the-Lamb-Stimmung: düster, kerzenwarm, okkulte Rims) ----
  // Schwaches violettes Umgebungslicht von oben, fast schwarz von unten.
  const hemi = new THREE.HemisphereLight(0x6a4a72, 0x080406, 0.55);
  scene.add(hemi);

  // Warmes „Kerzen"-Key-Light statt neutralem Weiß.
  const key = new THREE.DirectionalLight(0xffd2a1, 1.2);
  key.position.set(14, 40, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); // 1024 statt 2048: deutlich weniger Stutter
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 130;
  key.shadow.camera.left = -55;
  key.shadow.camera.right = 55;
  key.shadow.camera.top = 55;
  key.shadow.camera.bottom = -55;
  key.shadow.bias = -0.0004;
  scene.add(key);

  // Okkulter Magenta-Rim aus dem Rücken → ritueller Kontursaum.
  const rim = new THREE.DirectionalLight(0xc2487a, 0.7);
  rim.position.set(-18, 12, -16);
  scene.add(rim);

  // Zweiter, kühl-violetter Fülllichtschein von der Seite (Tiefe + Vibe).
  const fill = new THREE.DirectionalLight(0x7a4ad6, 0.35);
  fill.position.set(20, 10, -6);
  scene.add(fill);

  // --- Gebäude (mehrere Räume, Wände, Treppe ins Obergeschoss) ---------------
  const half = CONFIG.arena.half;

  // Office-Kulisse + umlaufender Hintergrund (Atmosphäre).
  buildOffice(scene);
  const backdrop = buildBackdrop(scene);

  // Große Büro-Hülle: das gesamte Areal liegt in einem Büro (Fensterwände,
  // Deckenlicht, Cubicles, Server-Racks, Pflanzen).
  buildOffice2(scene);

  // Das begehbare Gebäude: Böden, Wände, Rampe, Räume.
  const building = new Building(scene);

  // --- Kamera-Rig (Follow + Screenshake) -------------------------------------
  const focus = new THREE.Vector3(0, 0, 0); // worauf die Kamera schaut
  let shake = 0;
  let camT = 0;

  // Dynamische Kamera-Perspektive: aktueller Versatz blendet zum Ziel-Versatz.
  const baseOffset = { ...CONFIG.camera.offset };
  const curOffset = { ...baseOffset };
  let targetOffset = { ...baseOffset };

  // Zoom (Tasten N/M): skaliert den Kamera-Abstand. <1 = näher an der Ente,
  // >1 = mehr von der Map sichtbar.
  let zoom = 1, targetZoom = 1;
  const ZOOM_MIN = 0.45, ZOOM_MAX = 5.5; // großes Gebäude: weit rauszoombar

  // Vorausschau (Flow): Kamera blickt leicht in Bewegungsrichtung.
  const lastTarget = new THREE.Vector3();
  let leadX = 0, leadZ = 0, initialized = false;
  const baseFov = CONFIG.camera.fov;
  let curFov = baseFov;

  function updateCamera(targetPos, dt) {
    camT += dt;

    // Bewegungs-Vorausschau aus der Spielerbewegung schätzen.
    if (!initialized) { lastTarget.set(targetPos.x, targetPos.y || 0, targetPos.z); initialized = true; }
    const vx = (targetPos.x - lastTarget.x) / Math.max(dt, 1e-3);
    const vz = (targetPos.z - lastTarget.z) / Math.max(dt, 1e-3);
    lastTarget.set(targetPos.x, targetPos.y || 0, targetPos.z);
    const speed = Math.hypot(vx, vz);
    leadX = damp(leadX, vx * 0.32, 3.5, dt); // ~0.3s vorausblicken
    leadZ = damp(leadZ, vz * 0.32, 3.5, dt);

    focus.x = damp(focus.x, targetPos.x + leadX, CONFIG.camera.followLerp, dt);
    focus.z = damp(focus.z, targetPos.z + leadZ, CONFIG.camera.followLerp, dt);
    focus.y = damp(focus.y, targetPos.y || 0, CONFIG.camera.followLerp, dt);

    // Perspektive sanft überblenden.
    curOffset.x = damp(curOffset.x, targetOffset.x, 2.6, dt);
    curOffset.y = damp(curOffset.y, targetOffset.y, 2.6, dt);
    curOffset.z = damp(curOffset.z, targetOffset.z, 2.6, dt);
    zoom = damp(zoom, targetZoom, 6, dt);

    // Höhenabhängiger Abstand: in oberen Etagen etwas weiter weg → Ebene sichtbar.
    const heightZoom = 1 + Math.max(0, focus.y) * 0.05;
    const eff = zoom * heightZoom;

    // Dezentes Speed-FOV für mehr Tempo-Gefühl (Flow).
    curFov = damp(curFov, baseFov + Math.min(7, speed * 0.45), 3, dt);
    if (Math.abs(camera.fov - curFov) > 0.01) {
      camera.fov = curFov;
      camera.updateProjectionMatrix();
    }

    const o = curOffset;
    const hover = Math.sin(camT * CONFIG.camera.hoverSpeed) * CONFIG.camera.hover;
    camera.position.set(
      focus.x + o.x * eff,
      (o.y * eff) + focus.y + hover,
      focus.z + o.z * eff
    );

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
    0.6, // strength: kräftiger Neon-Schein, aber nicht überstrahlt
    0.45, // radius
    0.85 // threshold: Neon (Rahmen/Geschosse/Monitor/TNT-Funke) glüht; matte Ente bleibt ruhig
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
    terrain: building, // building liefert heightAt() wie früher das Terrain
    building,
  };

  // Zoom-Steuerung (N = näher → negativer Delta, M = weiter → positiver Delta).
  // delta wird direkt aufaddiert; der Aufrufer skaliert mit dt für sanften Flow.
  api.zoom = (delta) => { targetZoom = clamp(targetZoom + delta, ZOOM_MIN, ZOOM_MAX); };
  api.resetZoom = () => { targetZoom = 1; };

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
  // Stimmungs-Tint (Fog + Hintergrundfarbe) je Map-Tier.
  api.setMood = (hex) => {
    scene.fog.color.setHex(hex);
    scene.background.setHex(hex);
  };

  // Das Gebäude ist fest; die Arena „wächst" nicht mehr. Bleibt als No-op,
  // damit bestehende Aufrufe (WaveManager) gültig sind.
  api.setArena = () => { api.arenaHalf = half; };

  return api;
}
