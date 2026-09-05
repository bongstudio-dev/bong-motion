// Renderer Three.js / WebGL2. Reemplaza al `renderFrame.js` (Canvas 2D) del
// palette-animator: Canvas 2D sólo hace transforms afines, así que una imagen
// rotada en X o Y sale cizallada en vez de en perspectiva. Ver LINEAGE.md.
//
// UN SOLO camino de dibujo (BRIEF §2.2): preview, scrub y export llaman a
// `draw(t01)`. Para exportar se redimensiona ESTE mismo renderer y se graba de
// ESTE mismo canvas — si hubiera un segundo camino, el export mentiría.

import * as THREE from "three";
import { getScene } from "../engine/getScene.js";
import { stageOf } from "../engine/camera.js";
import { createPlaneMaterial } from "./planeMaterial.js";
import { createTextOverlay } from "./textOverlay.js";
import { getTexture, placeholderTexture } from "../assets/assetStore.js";

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    // Necesario para que captureStream() y toBlob() sean confiables (BRIEF §9).
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // El frame se compone en varios pases (texto de fondo, escena, texto de
  // frente): el limpiado lo hacemos a mano, una sola vez, al empezar.
  renderer.autoClear = false;

  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const anisoDone = new WeakSet();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 10, 10000);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const meshes = [];
  const textOverlay = createTextOverlay();

  const clear = new THREE.Color();
  const bg = new THREE.Color();

  // Los planos escalan mucho hacia abajo (carousel, orbit): sin anisotropía
  // aliasea feo. Se aplica una vez por textura, la primera vez que se usa.
  function prepare(texture) {
    if (texture && !anisoDone.has(texture)) {
      texture.anisotropy = maxAnisotropy;
      texture.needsUpdate = true;
      anisoDone.add(texture);
    }
    return texture;
  }

  function meshAt(i) {
    let m = meshes[i];
    if (!m) {
      m = new THREE.Mesh(geometry, createPlaneMaterial());
      // Con planos grandes y rotados el culling por bounding sphere descarta de
      // más; con ≤ 24 planos no vale la pena arriesgarlo.
      m.frustumCulled = false;
      scene.add(m);
      meshes[i] = m;
    }
    return m;
  }

  function draw(t01, state, opts = {}) {
    const stage = opts.stage ?? stageOf(state);
    const composed = getScene(t01, state, { stage });

    const cam = composed.camera;
    camera.fov = cam.fov;
    camera.aspect = cam.aspect;
    camera.near = cam.near;
    camera.far = cam.far;
    camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
    camera.lookAt(cam.lookAt[0], cam.lookAt[1], cam.lookAt[2]);
    camera.updateProjectionMatrix();

    clear.set(state.stage.background || "#000000");
    renderer.setClearColor(clear, 1);
    renderer.clear();
    bg.set(state.fit?.containBg || "#000000");

    textOverlay.update(state.texts, stage, renderer.getPixelRatio());
    textOverlay.render(renderer, "back");

    const planes = composed.planes;
    for (let i = 0; i < planes.length; i++) {
      const pl = planes[i];
      const mesh = meshAt(i);

      mesh.visible = pl.opacity > 0.002;
      if (!mesh.visible) continue;

      mesh.position.set(pl.pos[0], pl.pos[1], pl.pos[2]);
      mesh.rotation.set(pl.rot[0], pl.rot[1], pl.rot[2]);
      mesh.scale.set(pl.size[0], pl.size[1], 1);
      mesh.renderOrder = pl.renderOrder;

      const map = prepare(
        pl.assetId ? getTexture(pl.assetId) : placeholderTexture(pl.placeholder),
      );
      const backMap = pl.backAssetId ? prepare(getTexture(pl.backAssetId)) : null;

      const u = mesh.material.uniforms;
      u.uMap.value = map;
      // Sin cara trasera propia apuntamos al mismo sampler: el mix lo descarta,
      // pero evitamos dejar un sampler sin bindear.
      u.uBackMap.value = backMap ?? map;
      u.uHasBack.value = backMap ? 1 : 0;
      u.uCrop.value.set(pl.crop[0], pl.crop[1], pl.crop[2], pl.crop[3]);
      const bc = pl.backCrop ?? pl.crop;
      u.uBackCrop.value.set(bc[0], bc[1], bc[2], bc[3]);
      u.uSize.value.set(pl.size[0], pl.size[1]);
      u.uRadius.value = pl.radius;
      u.uOpacity.value = pl.opacity;
      // Sólo las sombras lo usan; el resto de los planos no trae `tint`.
      u.uTint.value = pl.tint ?? 1;
      // En `contain` el sobrante se pinta con este color; en el resto de los
      // modos el shader nunca sale de [0,1] y el valor no se usa.
      u.uBg.value.set(bg.r, bg.g, bg.b, 1);
    }

    for (let i = planes.length; i < meshes.length; i++) meshes[i].visible = false;

    renderer.render(scene, camera);
    textOverlay.render(renderer, "over");
    return composed;
  }

  return {
    canvas: renderer.domElement,
    renderer,
    draw,
    setSize(w, h, pixelRatio = 1) {
      renderer.setPixelRatio(pixelRatio);
      // updateStyle = false: el tamaño en pantalla lo maneja el Stage por CSS,
      // así el backing store puede cambiar durante el export sin saltos.
      renderer.setSize(Math.round(w), Math.round(h), false);
    },
    dispose() {
      for (const m of meshes) m.material.dispose();
      geometry.dispose();
      textOverlay.dispose();
      renderer.dispose();
    },
  };
}
