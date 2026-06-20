// Bootstrap: Welt + Systeme aufbauen, UI verdrahten, Game-Loop starten.
import * as THREE from "three";
import { createWorld } from "./scene.js";
import { Input } from "./input.js";
import { HUD } from "./hud.js";
import { Audio } from "./audio.js";
import { Game } from "./game.js";
import { loadModel } from "./assets.js";

const canvas = document.getElementById("game");
const world = createWorld(canvas);
const input = new Input();
const hud = new HUD();
const audio = new Audio();
const game = new Game({ world, input, hud, audio });

// --- UI verdrahten ---------------------------------------------------------
function beginGame() {
  if (game.state === "playing") return;
  audio.init();
  audio.resume();
  game.start();
}

hud.el.startBtn.addEventListener("click", beginGame);
hud.el.restartBtn.addEventListener("click", beginGame);
hud.el.resumeBtn.addEventListener("click", () => game.resume());
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && game.state !== "playing") beginGame();
});

hud.showStart();

// --- AI-Assets nachladen (optional, Fallback = Platzhalter/prozedural) -----
loadModel("./assets/duck.glb", { targetHeight: 2.4 }).then((obj) => {
  if (obj) {
    game.player.setModel(obj);
    console.info("[assets] Helden-Ente (GLB) geladen.");
  }
});

const BUG_TYPES = ["syntax", "stackoverflow", "racecondition", "memoryleak", "heisenbug"];
for (const type of BUG_TYPES) {
  loadModel(`./assets/bug_${type}.glb`, { targetHeight: 2 }).then((obj) => {
    if (obj) {
      game.enemies.setModel(type, obj);
      console.info("[assets] Bug-Modell geladen:", type);
    }
  });
}

// --- Game-Loop -------------------------------------------------------------
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); // Spikes kappen
  game.update(dt);
  world.renderer.render(world.scene, world.camera);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
