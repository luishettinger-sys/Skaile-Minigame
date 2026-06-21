// Bootstrap: Welt + Systeme aufbauen, UI verdrahten, Game-Loop starten.
import * as THREE from "three";
import { createWorld } from "./scene.js";
import { Input } from "./input.js";
import { HUD } from "./hud.js";
import { Audio } from "./audio.js";
import { Game } from "./game.js";
import { loadModel } from "./assets.js";
import { loadWeaponModels } from "./weaponmodels.js";

const canvas = document.getElementById("game");
const world = createWorld(canvas);
const input = new Input();
const hud = new HUD();
const audio = new Audio();
const game = new Game({ world, input, hud, audio });
window.__game = game; // Debug-Hook (Konsole)

// --- UI verdrahten ---------------------------------------------------------
function beginGame() {
  if (game.state === "playing") return;
  hud.hideSkins();
  audio.init();
  audio.resume();
  game.start();
}

hud.el.startBtn.addEventListener("click", beginGame);
hud.el.restartBtn.addEventListener("click", beginGame);
hud.el.resumeBtn.addEventListener("click", () => game.resume());
hud.el.invClose.addEventListener("click", () => game.toggleInventory());
hud.el.invSort.addEventListener("click", () => game.sortInventory());
hud.el.shopClose.addEventListener("click", () => game.toggleShop());
hud.el.skinsBtn?.addEventListener("click", () => game.openSkins("bank"));
hud.el.skinsBtnOver?.addEventListener("click", () => game.openSkins("bank"));
hud.el.skinsBtnPause?.addEventListener("click", () => game.openSkins("bank"));
hud.el.skinsBtnShop?.addEventListener("click", () => game.openSkins("run"));
hud.el.skinsClose?.addEventListener("click", () => game.closeSkins());
hud.el.upgradesBtn?.addEventListener("click", () => game.openUpgrades());
hud.el.upgradesBtnPause?.addEventListener("click", () => game.openUpgrades());
hud.el.upgradesBtnOver?.addEventListener("click", () => game.openUpgrades());
hud.el.upgradesClose?.addEventListener("click", () => game.closeUpgrades());
hud.el.victoryContinue?.addEventListener("click", () => game.resumeFromVictory());
hud.el.victoryMenu?.addEventListener("click", () => game.endRunToMenu());
window.addEventListener("keydown", (e) => {
  // Nur aus Menü/Game-Over per Space starten – im Sieg-Screen entscheiden die
  // Buttons (sonst gingen die noch nicht gebuchten Run-Coins verloren).
  if (e.code === "Space" && (game.state === "menu" || game.state === "over")) beginGame();
});

hud.showStart();

// --- AI-Assets vorladen mit Ladescreen -------------------------------------
const BUG_TYPES = ["syntax", "stackoverflow", "racecondition", "memoryleak", "heisenbug", "infinite", "nullptr", "boss"];
const loaderEl = document.getElementById("loading");
const loadFill = document.getElementById("load-fill");
const totalJobs = 1 + BUG_TYPES.length;
let doneJobs = 0;
let loaderHidden = false;

function hideLoader() {
  if (loaderHidden) return;
  loaderHidden = true;
  loaderEl.classList.add("hidden");
}
function assetTick() {
  doneJobs++;
  if (loadFill) loadFill.style.width = Math.round((doneJobs / totalJobs) * 100) + "%";
  if (doneJobs >= totalJobs) hideLoader();
}
setTimeout(hideLoader, 9000); // Fallback, falls etwas hängt

// Statisches Enten-Modell: kleiner (1.7) und ohne Eigen-Leuchten (noGlow).
loadModel("./assets/duck.glb", { targetHeight: 1.7, noGlow: true }).then((obj) => {
  if (obj) game.player.setModel(obj);
  game.applyEquippedSkin(); // gewählten Skin auf die Ente legen
  assetTick();
});
for (const type of BUG_TYPES) {
  loadModel(`./assets/bug_${type}.glb`, { targetHeight: 2 }).then((obj) => {
    if (obj) game.enemies.setModel(type, obj);
    assetTick();
  });
}

// Verkäufer-Ente am Shop-Stand (AI-Modell, optional).
loadModel("./assets/shopkeeper.glb", { targetHeight: 2.6 }).then((obj) => {
  if (obj) game.stations.setKeeperModel(obj);
});

// CotL-Schrein „Kult der Ente": Hero-Asset (Higgsfield→Blender, web-optimiert)
// als Arena-Mittelpunkt. Steht nördlich des Ritual-Sigills, wirft Schatten.
loadModel("./assets/props/duck_shrine.glb", { targetHeight: 4.6 }).then((obj) => {
  if (!obj) return;
  obj.position.set(0, 0, -15);
  obj.rotation.y = Math.PI; // Vorderseite (Ente) zur Arena
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  world.scene.add(obj);
  // Kollision: nicht durch den Altar laufen.
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  world.building?.walls?.push({
    minX: box.min.x + 0.3, maxX: box.max.x - 0.3,
    minZ: box.min.z + 0.3, maxZ: box.max.z - 0.3,
  });
});

// KI-Hero-Props (Higgsfield→Blender) statt grober prozeduraler Formen: Stein-
// Fackeln + Kandelaber. Ein GLB wird geladen und an mehrere Stellen geklont,
// jeweils mit warmem Punktlicht + Glüh-Halo (Bloom) am Feuer.
function placeFireProps(url, targetHeight, fireY, positions, withLight, haloR) {
  loadModel(url, { targetHeight }).then((obj) => {
    if (!obj) return;
    positions.forEach((pos, i) => {
      const [x, z, ry] = pos;
      const inst = i === 0 ? obj : obj.clone(true);
      inst.position.set(x, 0, z);
      inst.rotation.y = ry || 0;
      inst.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      world.scene.add(inst);
      // Glüh-Halo am Feuer (für Bloom-Schein).
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(haloR, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.5, depthWrite: false })
      );
      halo.position.set(x, fireY, z);
      world.scene.add(halo);
      if (withLight[i]) {
        const light = new THREE.PointLight(0xffb060, 26, 30, 2);
        light.position.set(x, fireY, z);
        world.scene.add(light);
      }
    });
  });
}

// 4 Stein-Fackeln an den Arena-Ecken (alle mit Licht).
placeFireProps("./assets/props/brazier.glb", 5.6, 5.2,
  [[21, 21], [21, -21], [-21, 21], [-21, -21]], [true, true, true, true], 1.1);

// Kandelaber flankieren den Schrein (Nord) + Süd-Eingang; nur die Nord-Paare leuchten.
placeFireProps("./assets/props/candelabra.glb", 4.4, 4.0,
  [[-3.6, -15], [3.6, -15], [-3.6, 18], [3.6, 18]], [true, true, false, false], 0.7);

// In Blender gebaute Waffenmodelle: an Armory-Podeste + getragene Waffe hängen.
loadWeaponModels().then(() => {
  game.armory.populateModels();
  game._refreshHeldWeapon();
});

// --- Game-Loop -------------------------------------------------------------
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); // Spikes kappen
  game.update(dt);
  world.render();
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
