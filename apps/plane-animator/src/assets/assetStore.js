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
//
// El canvas se dibuja CON EL ASPECTO DEL PLANO. El motor calcula el recorte con
// `asset?.aspect ?? planeAspect`, o sea que a falta de asset da por hecho que la
// textura ya viene con la proporción del plano y no recorta nada. Con un canvas
// siempre cuadrado esa suposición era falsa y el número salía comprimido en
// cuanto el plano dejaba de ser 1:1.
export function placeholderTexture(n, aspect = 1) {
  const num = Math.max(1, Math.round(n));
  const a = Number.isFinite(aspect) && aspect > 0 ? clampAspect(aspect) : 1;
  const key = `${num}@${a}`;
  let tex = placeholders.get(key);
  if (tex) return tex;

  // Lado mayor fijo: el chico sale de la proporción. Así un 9:16 no dibuja un
  // canvas gigante sólo por ser alto.
  const LONG = 512;
  const w = a >= 1 ? LONG : Math.round(LONG * a);
  const h = a >= 1 ? Math.round(LONG / a) : LONG;

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#26272c";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "#3a3b42";
  g.lineWidth = 6;
  g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = "#63646b";
  // El cuerpo sale del lado menor: el número tiene que entrar en un plano
  // angosto igual que en uno cuadrado.
  const body = Math.round(Math.min(w, h) * 0.37);
  g.font = `700 ${body}px Satoshi, ui-sans-serif, system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(num), w / 2, h / 2 + body * 0.04);

  tex = configure(new THREE.CanvasTexture(c));
  placeholders.set(key, tex);
  return tex;
}

// Se cachea una textura por número y proporción; redondear evita que un ratio
// libre arrastrado con el mouse genere una textura nueva por píxel.
const clampAspect = (a) => Math.round(Math.min(4, Math.max(0.25, a)) * 100) / 100;

// ¿Algún asset se queda corto para el export pedido? (BRIEF §6)
export function upscaleWarning(assets, targetShortSide) {
  const low = assets.filter((a) => {
    const e = store.get(a.id);
    if (!e) return false;
    return Math.min(e.srcW, e.srcH) < targetShortSide;
  });
  return low.length ? low.map((a) => a.name) : null;
}
