// 3D-Welt: Renderer, Szene, Kamera, Licht, Arena (Code-Grid), Kamera-Rig.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CONFIG } from "./config.js";
import { damp } from "./utils.js";
import { buildRoomDecor } from "./roomdecor.js";
import { Building } from "./building.js";
import { clamp } from "./utils.js";

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  // Pixelratio 1.5 (Balance Schärfe/Performance); MSAA übernimmt die Kanten-Glättung.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35; // hell & freundlich (ORAS-Büro), gut lesbar
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.bg);
  // Fog of War: enger schwarzer Nebel um die Kamera → nur ein Sicht-Radius um die
  // Ente ist hell, der Rest fällt ins Schwarze und deckt sich beim Näherkommen auf.
  // near/far werden in updateCamera dynamisch an Kamera-Distanz + Sichtweite gesetzt.
  scene.fog = new THREE.Fog(CONFIG.colors.fog, 20, 60);
  let visionRange = CONFIG.vision?.base ?? 30;

  // Image-Based-Lighting: gibt allen PBR-Materialien Reflexionen → „echt"
  // statt flach. Erzeugt aus einer prozeduralen Raum-Umgebung.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.45).texture;

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(0, CONFIG.camera.offset.y, CONFIG.camera.offset.z);
  camera.lookAt(0, 0, 0);

  // --- Licht (helles, freundliches Büro – ORAS-Vibe, gut lesbar) -------------
  // Helles, neutral-warmes Umgebungslicht von oben, sanfter Boden-Fill.
  const hemi = new THREE.HemisphereLight(0xdce8f5, 0x8a8478, 0.95);
  scene.add(hemi);

  // Helles, leicht warmes Key-Light (Sonnenlicht durchs Bürofenster).
  const key = new THREE.DirectionalLight(0xfff4e2, 1.35);
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

  // Kühler Himmels-Rim von hinten → frische, freundliche Tiefe.
  const rim = new THREE.DirectionalLight(0xbcd4ec, 0.4);
  rim.position.set(-18, 12, -16);
  scene.add(rim);

  // Weicher neutraler Fülllichtschein von der Seite.
  const fill = new THREE.DirectionalLight(0xcfd8e4, 0.4);
  fill.position.set(20, 10, -6);
  scene.add(fill);

  // --- Gebäude (kompakte Arena + 4 Funktionsräume) ---------------------------
  const half = CONFIG.arena.half;
  const backdrop = null; // Büro-Kulisse entfernt (Theme: PC-Inneres, dunkler Void)

  // Das begehbare Gebäude: Böden, Wände, Räume.
  const building = new Building(scene);

  // PC-Inneres: Platinen-Deko (RAM-Riegel, Kondensatoren, Chip-Mittelpunkt) statt
  // Büro-Möbel.
  buildRoomDecor(scene, building.rooms);

  // --- Kamera-Rig (Follow + Screenshake) -------------------------------------
  const focus = new THREE.Vector3(0, 0, 0); // worauf die Kamera schaut
  let shake = 0;
  let camT = 0;

  // Zwei Kamera-Modi (Taste Q wechselt):
  //   0 = Vogelperspektive (steil von oben, großer Überblick)
  //   1 = Drohne (3rd-Person hinter der Ente, action-reicher)
  let camMode = 0;
  const BIRDS = { y: 30, z: 11 };                  // hoch & steil
  const DRONE = { dist: 17, y: 9.5, lookAhead: 7 }; // hinter der Ente, etwas weiter weg
  let camDir = 0; // geglättete „Director"-Blickrichtung (Drohne)

  // Vorausschau (Flow): Kamera blickt leicht in Bewegungsrichtung.
  const lastTarget = new THREE.Vector3();
  let leadX = 0, leadZ = 0, initialized = false;
  const baseFov = CONFIG.camera.fov;
  let curFov = baseFov;

  // Winkel weich nachziehen (mit Wrap-around).
  function angleDamp(cur, target, lambda, dt) {
    let d = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return cur + d * (1 - Math.exp(-lambda * dt));
  }

  function updateCamera(targetPos, dt, heading = 0) {
    camT += dt;

    if (!initialized) { lastTarget.set(targetPos.x, targetPos.y || 0, targetPos.z); initialized = true; camDir = heading; }
    const vx = (targetPos.x - lastTarget.x) / Math.max(dt, 1e-3);
    const vz = (targetPos.z - lastTarget.z) / Math.max(dt, 1e-3);
    lastTarget.set(targetPos.x, targetPos.y || 0, targetPos.z);
    const speed = Math.hypot(vx, vz);
    leadX = damp(leadX, vx * 0.4, 5, dt);
    leadZ = damp(leadZ, vz * 0.4, 5, dt);

    focus.x = damp(focus.x, targetPos.x + leadX, CONFIG.camera.followLerp, dt);
    focus.z = damp(focus.z, targetPos.z + leadZ, CONFIG.camera.followLerp, dt);
    focus.y = damp(focus.y, targetPos.y || 0, CONFIG.camera.followLerp, dt);

    const hover = Math.sin(camT * CONFIG.camera.hoverSpeed) * CONFIG.camera.hover;
    let lookX = focus.x, lookY = focus.y, lookZ = focus.z, camDist;

    // Director-Richtung immer weich nachziehen (langsam → cinematisch, kein Whip).
    camDir = angleDamp(camDir, heading, 3.2, dt);
    if (camMode === 1) {
      // Drohne: hinter der Ente entlang der Director-Richtung, über die Schulter.
      const fx = Math.sin(camDir), fz = Math.cos(camDir);
      camera.position.set(
        focus.x - fx * DRONE.dist,
        focus.y + DRONE.y + hover,
        focus.z - fz * DRONE.dist
      );
      lookX = focus.x + fx * DRONE.lookAhead;
      lookZ = focus.z + fz * DRONE.lookAhead;
      lookY = focus.y + 1.4;
      camDist = Math.hypot(DRONE.dist, DRONE.y);
    } else {
      // Vogelperspektive: steil von oben.
      camera.position.set(focus.x, focus.y + BIRDS.y + hover, focus.z + BIRDS.z);
      camDist = Math.hypot(BIRDS.y, BIRDS.z);
    }

    // Dezentes Speed-FOV für mehr Tempo-Gefühl (Flow).
    curFov = damp(curFov, baseFov + Math.min(11, speed * 0.6), 4, dt);
    if (Math.abs(camera.fov - curFov) > 0.01) { camera.fov = curFov; camera.updateProjectionMatrix(); }

    // Fog of War relativ zur Kamera-Distanz.
    scene.fog.near = camDist + visionRange * 0.12;
    scene.fog.far = camDist + visionRange * 0.85;

    if (shake > 0.0001) {
      shake = Math.max(0, shake - dt * 1.6);
      const s = shake * shake;
      camera.position.x += (Math.random() - 0.5) * s * 6;
      camera.position.y += (Math.random() - 0.5) * s * 4;
      camera.position.z += (Math.random() - 0.5) * s * 6;
    }
    camera.lookAt(lookX, lookY, lookZ);
  }

  function toggleCam() { camMode = camMode === 0 ? 1 : 0; return camMode; }

  function addShake(amount) {
    shake = Math.min(1, shake + amount);
  }

  // --- Direktes Rendering (KEIN Post-Processing) -----------------------------
  // Früher: Outline-Normalen-Prepass (Szene 2× pro Frame) + Bloom-Composer →
  // teuer (FPS-Drops) UND die schwarzen Kanten wirkten zu hart. Jetzt direkt
  // gerendert mit dem nativen MSAA des Renderers (antialias:true) → sauber & schnell.
  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize);

  const api = {
    renderer, scene, camera, updateCamera, addShake, resize,
    arenaHalf: half,
    terrain: building, // building liefert heightAt() wie früher das Terrain
    building,
  };

  // Kamera-Modus wechseln (Taste Q): Vogel ↔ Drohne.
  api.toggleCam = () => toggleCam();
  api.isDrone = () => camMode === 1;       // Drohne aktiv?
  api.camHeading = () => camDir;            // aktuelle Director-Blickrichtung
  // Zoom/feste Perspektiven gibt es nicht mehr (No-ops für Altaufrufe).
  api.zoom = () => {};
  api.resetZoom = () => {};
  api.setCamera = () => {};
  api.resetCamera = () => {};
  api.setBackdrop = () => {}; // Büro-Backdrop entfernt (PC-Theme)
  api.render = () => {
    renderer.render(scene, camera); // direkt, ohne Post-Processing → flüssig
  };
  // Sicht-Radius setzen (Fog of War, per Level-Up erweiterbar).
  api.setVision = (range) => { visionRange = Math.max(8, range); };

  // Stimmungs-Tint je Map-Tier – stark abgedunkelt, damit der Fog-of-War-Void
  // schwarz bleibt (nur ein Hauch Sektor-Farbe im Nebel).
  api.setMood = (hex) => {
    const c = new THREE.Color(hex).multiplyScalar(0.12);
    scene.fog.color.copy(c);
    scene.background.copy(c);
  };

  // Das Gebäude ist fest; die Arena „wächst" nicht mehr. Bleibt als No-op,
  // damit bestehende Aufrufe (WaveManager) gültig sind.
  api.setArena = () => { api.arenaHalf = half; };

  return api;
}
