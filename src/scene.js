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

  // PC-Inneres: große Themen-Maschinen je Funktionsraum (Schmiede-Esse,
  // Motherboard-Wand, 3D-Drucker, Forschungs-Mainframe) statt leerer Räume.
  const decor = buildRoomDecor(scene, building.rooms);

  // Boden-Daten-Pakete entfernt (Wunsch Luis): die wandernden Punkte wirkten
  // zu unruhig/hibbelig und lenkten vom Spielgeschehen ab.
  const dataFlow = null;

  // --- Kamera-Rig (Follow + Screenshake) -------------------------------------
  const focus = new THREE.Vector3(0, 0, 0); // worauf die Kamera schaut
  let shake = 0;
  let camT = 0;

  // Nur EINE Perspektive: Vogelperspektive (steil von oben). In den kleinen
  // Seitenräumen rückt die Kamera etwas näher an die Ente (camClose 0→1).
  const BIRDS = { y: 36, z: 22 };       // Arena: stärker geneigt (dynamischer 3/4-Blick)
  const ROOM  = { y: 22, z: 14 };       // kleiner Raum (näher + geneigt)
  let camClose = 0, camCloseTarget = 0;
  let camYaw = 0, camYawTarget = 0; // 0 = Standard, π = 180°-Verteidigungsblick (PC unten)
  let bank = 0, yawSway = 0; // dynamische Roll-/Gier-Neigung

  // Vorausschau (Flow): Kamera blickt leicht in Bewegungsrichtung.
  const lastTarget = new THREE.Vector3();
  let leadX = 0, leadZ = 0, initialized = false;
  const baseFov = CONFIG.camera.fov;
  let curFov = baseFov;

  function updateCamera(targetPos, dt) {
    camT += dt;

    if (!initialized) { lastTarget.set(targetPos.x, targetPos.y || 0, targetPos.z); initialized = true; }
    const vx = (targetPos.x - lastTarget.x) / Math.max(dt, 1e-3);
    const vz = (targetPos.z - lastTarget.z) / Math.max(dt, 1e-3);
    lastTarget.set(targetPos.x, targetPos.y || 0, targetPos.z);
    const speed = Math.hypot(vx, vz);
    leadX = damp(leadX, vx * 0.22, 5, dt); // minimale Vorausschau (kaum Kippeln)
    leadZ = damp(leadZ, vz * 0.22, 5, dt);

    focus.x = damp(focus.x, targetPos.x + leadX, CONFIG.camera.followLerp, dt);
    focus.z = damp(focus.z, targetPos.z + leadZ, CONFIG.camera.followLerp, dt);
    focus.y = damp(focus.y, targetPos.y || 0, CONFIG.camera.followLerp, dt);

    const hover = Math.sin(camT * CONFIG.camera.hoverSpeed) * CONFIG.camera.hover;

    // Kamera-Nähe weich überblenden (Arena ↔ kleiner Raum).
    camClose = damp(camClose, camCloseTarget, 4, dt);
    camYaw = damp(camYaw, camYawTarget, 3, dt); // sanft um 180° schwenken beim Verteidigen
    const camY = BIRDS.y + (ROOM.y - BIRDS.y) * camClose;
    const camZ = BIRDS.z + (ROOM.z - BIRDS.z) * camClose;
    const cs = Math.sin(camYaw), cc = Math.cos(camYaw);
    camera.position.set(focus.x - camZ * cs, focus.y + camY + hover, focus.z + camZ * cc);
    const camDist = Math.hypot(camY, camZ);
    const lookX = focus.x, lookY = focus.y, lookZ = focus.z;

    // Dezentes Speed-FOV für mehr Tempo-Gefühl (Flow).
    curFov = damp(curFov, baseFov + Math.min(11, speed * 0.6), 4, dt);
    if (Math.abs(camera.fov - curFov) > 0.01) { camera.fov = curFov; camera.updateProjectionMatrix(); }

    // Fog of War relativ zur Kamera-Distanz.
    scene.fog.near = camDist + visionRange * 0.12;
    scene.fog.far = camDist + visionRange * 0.85;

    if (shake > 0.0001) {
      shake = Math.max(0, shake - dt * 2.0); // schneller abklingen
      const s = shake * shake;
      camera.position.x += (Math.random() - 0.5) * s * 3.4; // sanfter (war 6)
      camera.position.y += (Math.random() - 0.5) * s * 2.2;
      camera.position.z += (Math.random() - 0.5) * s * 3.4;
    }
    camera.lookAt(lookX, lookY, lookZ);

    // Banking praktisch aus: nur ein winziger Rest-Roll, kein Gieren mehr →
    // das Bild steht beim Laufen ruhig (Kippeln verursachte Kopfschmerzen).
    bank = damp(bank, leadX * 0.002, 4, dt);
    camera.rotation.z += clamp(bank, -0.01, 0.01);
  }

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

  // Kamera-Nähe: in kleinen Räumen näher an die Ente (close=true), in der Arena weiter.
  api.setCamZoom = (close) => { camCloseTarget = close ? 1 : 0; };
  // Verteidigungs-Blick: am Tor dreht die Kamera 180° (PC-Raum nach unten/Süd).
  api.setDefendView = (on) => { camYawTarget = on ? Math.PI : 0; };
  api.getCamYaw = () => camYaw;
  // Kamera SOFORT auf ein Ziel + Yaw setzen (ohne Damping/Schwenk) – für saubere
  // Übergänge aus einer Cutscene in die Spielperspektive (kein Sprung/Spin).
  api.primeDefendView = (pos, on) => {
    camYaw = camYawTarget = on ? Math.PI : 0;
    camClose = camCloseTarget = 0;
    focus.set(pos.x, pos.y || 0, pos.z);
    lastTarget.set(pos.x, pos.y || 0, pos.z);
    initialized = true;
  };
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

  // Maschinen-Animation (blinkende Chips, fahrender Druckkopf, glühende Esse …)
  // + fließende Daten-Pakete über die Platine.
  api.updateDecor = (t, dt) => {
    const a = decor?.userData?.animated;
    if (a) for (const it of a) it.fn(t);
    dataFlow?.update(dt || 0.016);
  };

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

// Fließende Daten-Pakete: glühende additive Sprites, die achsen-parallel über den
// Arena-Boden wandern (wie Signale auf Leiterbahnen) und am Rand neu starten.
function buildDataFlow(scene, half) {
  const group = new THREE.Group();
  scene.add(group);
  const tex = makeGlowSprite();
  const COLORS = [0x2bd4ff, 0x39ff9a, 0xff8c1a, 0xc792ea];
  const packets = [];
  const N = 46;
  const lim = half - 1.5;
  const mk = () => {
    const axis = Math.random() < 0.5 ? "x" : "z";
    const lane = Math.round((Math.random() * 2 - 1) * lim / 2) * 2; // gerasterte Spuren
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = 8 + Math.random() * 14;
    const col = COLORS[(Math.random() * COLORS.length) | 0];
    const mat = new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(1.1, 1.1, 1);
    spr.position.y = 0.12;
    group.add(spr);
    return { spr, axis, lane, dir, speed, pos: (Math.random() * 2 - 1) * lim };
  };
  for (let i = 0; i < N; i++) packets.push(mk());
  return {
    update(dt) {
      for (const p of packets) {
        p.pos += p.dir * p.speed * dt;
        if (p.pos > lim || p.pos < -lim) {
          // neu einsetzen mit frischer Spur/Farbe.
          p.pos = -p.dir * lim;
          p.lane = Math.round((Math.random() * 2 - 1) * lim / 2) * 2;
          p.axis = Math.random() < 0.5 ? "x" : "z";
        }
        if (p.axis === "x") { p.spr.position.x = p.pos; p.spr.position.z = p.lane; }
        else { p.spr.position.x = p.lane; p.spr.position.z = p.pos; }
        // am Rand ein-/ausblenden (kein hartes Ploppen).
        const edge = 1 - Math.abs(p.pos) / lim;
        p.spr.material.opacity = Math.min(0.85, edge * 1.6);
      }
    },
  };
}

// Kleine radiale Glow-Textur für additive Sprites.
function makeGlowSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
