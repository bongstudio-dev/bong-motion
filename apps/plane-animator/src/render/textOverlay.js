// Capas de texto sobre la escena 3D.
//
// WebGL no dibuja texto. La alternativa —un div HTML encima del canvas— rompe
// el invariante que sostiene toda la tool: el archivo sale del MISMO canvas que
// se previsualiza (BRIEF §2.2), y un div no entra en `captureStream` ni en
// `VideoFrame`. Así que el texto se rasteriza en un canvas 2D suelto, se sube
// como textura y se dibuja como un quad ortográfico a pantalla completa. Sigue
// habiendo un solo camino de dibujo.
//
// Dos quads, no uno: `back` va antes de la escena (el texto queda debajo de los
// planos) y `over` después. `middle` y `front` comparten el quad de arriba, en
// ese orden — hoy no hay nada intercalado entre las dos, y el orden relativo
// entre capas sí se respeta.

import * as THREE from "three";
import { drawTexts, hasTexts } from "@bong/ui/text";

const SLOTS = { back: ["back"], over: ["middle", "front"] };

function createLayer() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture, used: false };
}

export function createTextOverlay() {
  const scene = new THREE.Scene();
  // Ortográfica de lado 1: el quad cubre el viewport entero sea cual sea el
  // ratio, sin tener que recalcular nada al cambiar de formato.
  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    // Sin profundidad: el orden lo da la secuencia de llamadas en `draw`, igual
    // que con los planos (que tampoco escriben depth).
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const layers = { back: createLayer(), over: createLayer() };
  let key = null;

  // Se rasteriza sólo cuando cambia algo. `texts` viene del state de React, así
  // que comparar por referencia alcanza: si el array es el mismo, nadie lo tocó.
  function update(texts, stage, pixelRatio) {
    const w = Math.max(1, Math.round(stage.w * pixelRatio));
    const h = Math.max(1, Math.round(stage.h * pixelRatio));
    const next = { texts, w, h };
    if (key && key.texts === texts && key.w === w && key.h === h) return;
    key = next;

    for (const [name, slots] of Object.entries(SLOTS)) {
      const layer = layers[name];
      layer.used = slots.some((s) => hasTexts(texts, s));
      if (!layer.used) continue;

      if (layer.canvas.width !== w || layer.canvas.height !== h) {
        layer.canvas.width = w;
        layer.canvas.height = h;
      }
      layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      layer.ctx.clearRect(0, 0, w, h);
      // El texto se mide en px lógicos del stage; la resolución de export es un
      // multiplicador sobre ese sistema, nunca una unidad nueva.
      layer.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      for (const slot of slots) drawTexts(layer.ctx, texts, stage, slot);
      layer.texture.needsUpdate = true;
    }
  }

  function render(renderer, name) {
    const layer = layers[name];
    if (!layer.used) return;
    material.map = layer.texture;
    material.needsUpdate = true;
    renderer.render(scene, camera);
  }

  return {
    update,
    render,
    has: (name) => layers[name].used,
    dispose() {
      geometry.dispose();
      material.dispose();
      for (const layer of Object.values(layers)) layer.texture.dispose();
    },
  };
}
