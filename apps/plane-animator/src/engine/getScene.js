// El compositor. BRIEF §3.
//
// getScene(t01, state) → { camera, planes[] }
//
// Función pura: mismo input, mismo output, siempre. Sin Date.now(), sin estado
// mutable, sin random no-seedeado. Preview, scrub y export consumen esta misma
// función — por eso el export es exacto.
//
// Reemplaza a `getFrame.js` del palette-animator: devuelve planos en 3D
// (pos/rot/size) en vez de rects alineados al eje.

import { clamp, lerp, mod, triangle } from "../utils/math.js";
import { makeEase } from "./ease.js";
import { makeCamera, stageOf, visibleAt, SHORT } from "./camera.js";
import { TEMPLATES, TEMPLATE_LIST, templateParams, ratioWH } from "./templates.js";

export { SHORT };

export function resolveTemplate(state) {
  return TEMPLATES[state?.template?.id] ?? TEMPLATE_LIST[0];
}

export function resolveParams(state, tpl) {
  const t = tpl ?? resolveTemplate(state);
  return templateParams(t, state?.template?.params?.[t.id]);
}

// Los assets ocultos no existen para el engine: `M` es siempre la cantidad de
// assets VISIBLES, que es lo que manda en la asignación y en el contrato §7.
export function visibleAssets(state) {
  return (state?.assets ?? [])
    .filter((a) => a && a.visible !== false && a.w > 0 && a.h > 0)
    .map((a) => ({
      id: a.id,
      aspect: a.w / a.h,
      focal: Array.isArray(a.focal) ? a.focal : [0, 0],
      fit: a.fit ?? "auto",
    }));
}

/* ---------------------------------------------------------------- */
/* Crop — BRIEF §5 / §6.5                                            */
/* ---------------------------------------------------------------- */

// Devuelve el uniform uCrop = [scaleX, scaleY, offsetX, offsetY]. Va por PLANO,
// no por textura: la misma imagen puede aparecer con distinto encuadre en dos
// planos sin clonar nada en la GPU.
//
// s < 1 → se muestrea un sub-rect de la textura (cover, se recorta).
// s > 1 → se muestrea fuera de [0,1] (contain, sobra fondo).
export function computeCrop(planeAspect, imgAspect, mode, focal) {
  if (!(imgAspect > 0) || !(planeAspect > 0)) return [1, 1, 0, 0];

  let sx = 1;
  let sy = 1;
  if (mode === "contain") {
    if (imgAspect > planeAspect) sy = imgAspect / planeAspect;
    else sx = planeAspect / imgAspect;
  } else {
    // cover — y también fitToAsset, donde planeAspect === imgAspect y da 1,1.
    if (imgAspect > planeAspect) sx = planeAspect / imgAspect;
    else sy = imgAspect / planeAspect;
  }

  // El focal sólo tiene sentido donde hay recorte, y se acota al margen
  // disponible para no salirse del asset.
  const slackX = Math.max(0, 1 - sx);
  const slackY = Math.max(0, 1 - sy);
  const fx = mode === "cover" ? clamp(focal?.[0] ?? 0, -0.5, 0.5) : 0;
  const fy = mode === "cover" ? clamp(focal?.[1] ?? 0, -0.5, 0.5) : 0;

  return [sx, sy, (1 - sx) / 2 + fx * slackX, (1 - sy) / 2 + fy * slackY];
}

/* ---------------------------------------------------------------- */
/* geom — lo que el template necesita saber del mundo                */
/* ---------------------------------------------------------------- */

// Cinta 1D: posiciones acumuladas a lo largo de un eje (BRIEF §6.5.2). Los
// templates que soportan fitToAsset NO pueden asumir paso fijo, así que la
// posición se calcula por acumulación. Con tamaños uniformes esto degenera
// exactamente en `center(j) = j * step`, así que hay un solo camino de código.
function makeBelt(size, P, gap, axis) {
  const s = [];
  for (let k = 0; k < P; k++) s.push(size(k)[axis]);

  const prefix = [0];
  for (let k = 0; k < P; k++) {
    prefix.push(prefix[k] + s[k] / 2 + gap + s[(k + 1) % P] / 2);
  }
  const len = prefix[P];

  const center = (j) => {
    const q = Math.floor(j / P);
    return q * len + prefix[j - q * P];
  };
  return {
    center,
    centerAt: (a) => {
      const f = Math.floor(a);
      return lerp(center(f), center(f + 1), a - f);
    },
    len,
  };
}

function makeGeom({ stage, camera, tpl, p, N, assets, fit }) {
  const M = assets.length;
  const supports = tpl.supportsFitToAsset !== false;

  // Los templates nuevos declaran `relativeUnits` y miden en fracción del lado
  // menor; los viejos siguen en px. Es lo único que el compositor necesita
  // saber de la unidad: el resto de la conversión la hace cada template.
  const unit = tpl.relativeUnits ? SHORT : 1;
  const baseW = (p.planeSize ?? 600) * unit;
  const baseH = baseW / ratioWH(p.planeRatio ?? "4:5");
  const area = baseW * baseH;

  const effFit = (a) => {
    const f = !a ? "cover" : a.fit === "auto" ? fit.mode : a.fit;
    return f === "fitToAsset" && !supports ? "cover" : f;
  };

  // Con `lock` el tamaño queda congelado al del primer asset que tocó el slot;
  // con `morph` sigue al asset que efectivamente está en la cinta.
  const locked = fit.transition === "lock";
  const shapeIndex =
    M === 0 ? () => 0 : locked ? (j) => mod(mod(j, N), M) : (j) => mod(j, M);

  // fitToAsset iguala el ÁREA, no el lado mayor: así una horizontal y una
  // vertical pesan visualmente lo mismo en un set mixto.
  const cache = new Map();
  const size = (j) => {
    const key = M === 0 ? 0 : shapeIndex(j);
    let s = cache.get(key);
    if (!s) {
      const a = M === 0 ? null : assets[key];
      if (a && effFit(a) === "fitToAsset" && a.aspect > 0) {
        const h = Math.sqrt(area / a.aspect);
        s = [a.aspect * h, h];
      } else {
        s = [baseW, baseH];
      }
      cache.set(key, s);
    }
    return s;
  };

  const P = M === 0 ? 1 : locked ? N : M;

  let varies = false;
  for (let k = 1; k < P && !varies; k++) {
    varies = Math.abs(size(k)[0] - size(0)[0]) > 0.5;
  }

  const belts = new Map();
  return {
    stage,
    SHORT,
    camZ: camera.position[2],
    N,
    M,
    P,
    morphs: !locked && varies,
    effFit,
    size,
    belt(gap, axis) {
      const key = `${gap}|${axis}`;
      let b = belts.get(key);
      if (!b) {
        b = makeBelt(size, P, gap, axis);
        belts.set(key, b);
      }
      return b;
    },
    visible: (z) => visibleAt(z, stage, camera),
  };
}

/* ---------------------------------------------------------------- */
/* getScene                                                          */
/* ---------------------------------------------------------------- */

export function getScene(t01, state, opts = {}) {
  const stage = opts.stage ?? stageOf(state);
  const camera = makeCamera(stage, state.stage.fov ?? 45);

  const tpl = resolveTemplate(state);
  const p = resolveParams(state, tpl);
  const timing = state.timing;
  const ease = makeEase(timing.ease);
  const N = Math.max(1, Math.round(tpl.count(p)));
  const assets = visibleAssets(state);
  const M = assets.length;
  const fit = state.fit ?? { mode: "cover", transition: "morph", containBg: "#0A0A0A" };
  const geom = makeGeom({ stage, camera, tpl, p, N, assets, fit });

  // t01 recorre la PIEZA entera; `cycles` es cuántas repeticiones del template
  // entran en ella. Por eso `tc` no se envuelve: el avance de assets tiene que
  // acumular a lo largo de los ciclos (BRIEF §7), no resetearse en cada uno.
  const cycles = Math.max(1, Math.round(timing.cycles));
  const x = clamp(t01, 0, 1);
  let tc;
  if (timing.direction === "reverse") tc = (1 - x) * cycles;
  else if (timing.direction === "pingpong") tc = triangle(x) * cycles;
  else tc = x * cycles;

  const planes = [];
  for (let i = 0; i < N; i++) {
    // El compositor aplica el stagger ANTES de llamar al template: el template
    // recibe su t ya desfasado y no sabe nada de stagger.
    const tLocal = tc - i * (timing.stagger ?? 0) - (timing.delay ?? 0);
    const out = tpl.place(tLocal, i, N, p, timing, ease, geom);

    const size = out.size;
    const planeAspect = size[1] > 0 ? size[0] / size[1] : 1;

    const slot = out.assetSlot ?? i;
    const assetIndex = M > 0 ? mod(slot, M) : -1;
    const asset = assetIndex >= 0 ? assets[assetIndex] : null;
    const mode = geom.effFit(asset);

    const backSlot = out.backSlot;
    const backIndex = backSlot != null && M > 0 ? mod(backSlot, M) : -1;
    const backAsset = backIndex >= 0 ? assets[backIndex] : null;

    planes.push({
      id: `p${i}`,
      assetIndex,
      assetId: asset?.id ?? null,
      // Sin assets cargados dibujamos placeholders numerados: la tool tiene que
      // ser usable antes de cargar nada (BRIEF §6.4).
      placeholder: M === 0 ? mod(slot, N) + 1 : 0,
      pos: out.pos,
      rot: out.rot,
      size,
      opacity: clamp(out.opacity ?? 1),
      radius: Math.max(0, out.radius ?? 0),
      crop: computeCrop(planeAspect, asset?.aspect ?? planeAspect, mode, asset?.focal),
      fitMode: mode,
      // Cara trasera (flip) — BRIEF §5.
      backAssetId: backAsset?.id ?? null,
      backCrop: backAsset
        ? computeCrop(planeAspect, backAsset.aspect, geom.effFit(backAsset), backAsset.focal)
        : null,
      mirrorBack: !!out.mirrorBack,
      doubleSided: backSlot != null || !!out.mirrorBack,
      // Más lejos primero: three dibuja los transparentes en renderOrder
      // ASCENDENTE, así que el orden es +z, no -z como sugería el brief.
      renderOrder: Math.round(out.pos[2]),
      // BRIEF §13: la puerta a color/texto queda abierta desde el día uno.
      fill: { type: "image" },
    });
  }

  planes.sort((a, b) => a.renderOrder - b.renderOrder);
  return { camera, planes, stage };
}

export default getScene;
