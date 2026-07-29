// Pipeline de assets. BRIEF §6.
//
//   File → createImageBitmap() → THREE.Texture
//
// La textura se sube a GPU UNA SOLA VEZ y se reusa entre planos: el crop va por
// uniform (uCrop), no clonando texturas. Por eso el store vive fuera de React —
// una THREE.Texture no es serializable ni tiene por qué re-renderizar nada.
//
// El state de React guarda sólo los metadatos (id, nombre, w, h, focal, fit,
// visible); los píxeles viven acá, indexados por id.

import * as THREE from "three";
import { uid } from "../utils/math.js";

// Un set de 12 imágenes a 4000px son ~700MB de VRAM con mipmaps. 2160 es
// exactamente lo que necesita un export 2× con lado menor 1080, así que no
// hace falta guardar el original.
export const MAX_SIDE = 2160;

const store = new Map(); // id → { texture, bitmap, thumbUrl, w, h, srcW, srcH }
const placeholders = new Map();

function configure(texture) {
  texture.colorSpace = THREE.SRGBColorSpace; // sin esto los JPG salen lavados
  texture.generateMipmaps = true; // los planos escalan mucho hacia abajo
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export async function ingestFile(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name}: no es una imagen`);
  }

  const src = await createImageBitmap(file);
  const srcW = src.width;
  const srcH = src.height;

  const longest = Math.max(srcW, srcH);
  const k = longest > MAX_SIDE ? MAX_SIDE / longest : 1;
  const w = Math.max(1, Math.round(srcW * k));
  const h = Math.max(1, Math.round(srcH * k));

  // `imageOrientation: 'flipY'` en el bitmap + `texture.flipY = false` es la
  // combinación confiable: UNPACK_FLIP_Y_WEBGL no aplica a ImageBitmap.
  const bitmap = await createImageBitmap(src, {
    resizeWidth: w,
    resizeHeight: h,
    resizeQuality: "high",
    imageOrientation: "flipY",
  });
  src.close?.();

  const texture = configure(new THREE.Texture(bitmap));
  texture.flipY = false;

  const id = uid("a");
  store.set(id, {
    texture,
    bitmap,
    thumbUrl: URL.createObjectURL(file),
    w,
    h,
    srcW,
    srcH,
  });

  return {
    id,
    name: file.name,
    w,
    h,
    srcW,
    srcH,
    visible: true,
    focal: [0, 0], // −0.5..0.5, punto de interés para el crop en `cover`
    fit: "auto", // 'auto' hereda el modo global
  };
}

export const getEntry = (id) => store.get(id) ?? null;
export const getTexture = (id) => store.get(id)?.texture ?? null;
export const getThumb = (id) => store.get(id)?.thumbUrl ?? null;

export function release(id) {
  const e = store.get(id);
  if (!e) return;
  e.texture.dispose();
  e.bitmap?.close?.();
  URL.revokeObjectURL(e.thumbUrl);
  store.delete(id);
}

export function releaseAll() {
  for (const id of [...store.keys()]) release(id);
}

// La tool tiene que ser usable antes de cargar nada: sin assets se dibujan
// placeholders grises numerados (BRIEF §6.4).
export function placeholderTexture(n) {
  const key = Math.max(1, Math.round(n));
  let tex = placeholders.get(key);
  if (tex) return tex;

  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#26272c";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = "#3a3b42";
  g.lineWidth = 6;
  g.strokeRect(3, 3, size - 6, size - 6);
  g.fillStyle = "#63646b";
  g.font = '700 190px Satoshi, ui-sans-serif, system-ui, sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(key), size / 2, size / 2 + 8);

  tex = configure(new THREE.CanvasTexture(c));
  placeholders.set(key, tex);
  return tex;
}

// ¿Algún asset se queda corto para el export pedido? (BRIEF §6)
export function upscaleWarning(assets, targetShortSide) {
  const low = assets.filter((a) => {
    const e = store.get(a.id);
    if (!e) return false;
    return Math.min(e.srcW, e.srcH) < targetShortSide;
  });
  return low.length ? low.map((a) => a.name) : null;
}
