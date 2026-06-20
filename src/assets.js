// Lädt optionale GLB-Modelle (AI-generiert) und normalisiert sie
// (auf Zielhöhe skalieren, zentrieren, Füße auf den Boden).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function loadModel(url, { targetHeight = 2.2, noGlow = false } = {}) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const obj = gltf.scene;

        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = targetHeight / (size.y || 1);
        obj.scale.setScalar(scale);

        const box2 = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        box2.getCenter(center);
        obj.position.x -= center.x;
        obj.position.z -= center.z;
        obj.position.y -= box2.min.y; // Füße auf Bodenhöhe

        obj.traverse((o) => {
          if (o.isMesh && o.material) {
            o.castShadow = true;
            o.receiveShadow = true;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
              if (noGlow) {
                // Emissive entfernen → Modell leuchtet nicht (kein Neon-Look).
                if (m.emissive) m.emissive.setHex(0x000000);
                if ("emissiveIntensity" in m) m.emissiveIntensity = 0;
                if ("emissiveMap" in m) m.emissiveMap = null;
                // matt halten, damit Bloom nichts aufgreift.
                if ("roughness" in m) m.roughness = Math.max(m.roughness ?? 0.6, 0.6);
                if ("metalness" in m) m.metalness = Math.min(m.metalness ?? 0, 0.2);
              }
              m.needsUpdate = true;
            }
          }
        });
        // Skelett-Animationen (falls gerigged) mitgeben.
        obj.userData.gltfAnimations = gltf.animations || [];
        resolve(obj);
      },
      undefined,
      (err) => {
        console.warn("[assets] Modell nicht geladen:", url, err?.message || err);
        resolve(null); // Fallback: Platzhalter bleibt aktiv
      }
    );
  });
}
