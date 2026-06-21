// Comic-Outline-Pass (Cult-of-the-Lamb-Look): zeichnet dunkle Konturlinien an
// Silhouetten und Kanten. Funktioniert über einen Normalen-Prepass + Kanten-
// erkennung im Screen-Space – kostet konstant (unabhängig von der Gegnerzahl)
// und erzeugt KEINE falschen Linien auf glatten, schrägen Flächen (z.B. Boden),
// weil Normalen-Diskontinuitäten statt Tiefen-Gradienten ausgewertet werden.
import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

export function createOutline(renderer, width, height) {
  // Vollauflösender Normalen-Buffer.
  const normalRT = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter, // weicher → Kanten flimmern beim Bewegen nicht
    magFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType,
  });
  const normalMaterial = new THREE.MeshNormalMaterial();

  const shader = {
    uniforms: {
      tDiffuse: { value: null }, // wird vom ShaderPass gefüllt (Farbbild)
      tNormal: { value: normalRT.texture },
      texel: { value: new THREE.Vector2(1 / width, 1 / height) },
      thickness: { value: 1.2 }, // dünner → weniger Flimmern beim Bewegen
      edgeLo: { value: 0.55 }, // höhere Schwelle → keine Linien auf feinem Rauschen
      edgeHi: { value: 1.15 }, // darüber: volle Linie
      strength: { value: 1.0 }, // Deckkraft der Linie (voll)
      outlineColor: { value: new THREE.Color(0x080310) }, // tiefdunkles Violett statt hartem Schwarz
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform sampler2D tNormal;
      uniform vec2 texel;
      uniform float thickness;
      uniform float edgeLo;
      uniform float edgeHi;
      uniform float strength;
      uniform vec3 outlineColor;

      vec3 readN(vec2 uv) {
        return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0);
      }

      void main() {
        vec4 col = texture2D(tDiffuse, vUv);
        vec2 o = texel * thickness;
        vec3 nc = readN(vUv);
        vec3 nl = readN(vUv + vec2(-o.x, 0.0));
        vec3 nr = readN(vUv + vec2( o.x, 0.0));
        vec3 nu = readN(vUv + vec2(0.0,  o.y));
        vec3 nd = readN(vUv + vec2(0.0, -o.y));
        float e = (1.0 - dot(nc, nl)) + (1.0 - dot(nc, nr))
                + (1.0 - dot(nc, nu)) + (1.0 - dot(nc, nd));
        float edge = smoothstep(edgeLo, edgeHi, e);
        vec3 outc = mix(col.rgb, outlineColor, edge * strength);
        gl_FragColor = vec4(outc, col.a);
      }
    `,
  };

  const pass = new ShaderPass(shader);
  // WICHTIG: ShaderPass klont die Uniforms und setzt RenderTarget-Texturen dabei
  // auf null (isRenderTargetTexture lässt sich nicht klonen) → Normalen-Textur
  // nach dem Klonen wieder explizit zuweisen.
  pass.uniforms.tNormal.value = normalRT.texture;

  function setSize(w, h) {
    normalRT.setSize(w, h);
    pass.uniforms.texel.value.set(1 / w, 1 / h);
  }

  // Normalen der Szene in den Buffer rendern (vor dem Composer aufrufen).
  function renderNormals(scene, camera) {
    const prevBg = scene.background;
    scene.background = null; // Hintergrundfarbe stört die Normalen nicht
    scene.overrideMaterial = normalMaterial;
    renderer.setRenderTarget(normalRT);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.overrideMaterial = null;
    scene.background = prevBg;
  }

  return { pass, setSize, renderNormals, normalRT };
}
