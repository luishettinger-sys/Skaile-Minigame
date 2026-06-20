// Lädt optionale GLB-Modelle (AI-generiert) und normalisiert sie
// (auf Zielhöhe skalieren, zentrieren, Füße auf den Boden).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function loadModel(url, { targetHeight = 2.2 } = {}) {
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
          if (o.isMesh) {
            o.castShadow = true;
            o.material && (o.material.needsUpdate = true);
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
