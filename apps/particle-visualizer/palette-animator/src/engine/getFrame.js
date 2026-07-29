// La firma que importa. Función PURA: mismo input, mismo output, siempre.
// Preview, scrub y export consumen esta misma función.
//
//   getFrame(t01, state) → [{ id, x, y, w, h, hex, name, opacity, rotate, z }]
//
// Orden (innegociable): 1) se resuelven todos los tracks, 2) se calcula el
// layout a partir de los weights, 3) recién ahí se aplican dx/dy/scale/rotate.

import { lerp, lerpRect, clamp } from "../utils/math.js";
import { makeEase } from "./ease.js";
import { layout, stageDims, innerBox, MIN_SIDE } from "./layout.js";
import { PRESETS, PRESET_LIST, baseTrack } from "./presets.js";

export function resolveParams(state) {
  const preset = PRESETS[state.motion.preset] ?? PRESET_LIST[0];
  return { ...preset.params, ...(state.motion.params ?? {}) };
}

export function currentLayoutMode(state) {
  const preset = PRESETS[state.motion.preset] ?? PRESET_LIST[0];
  return state.layout?.mode ?? preset.defaultLayout;
}

export function getFrame(t01, state, opts = {}) {
  const palette = state.palette ?? [];
  const N = palette.length;
  if (N === 0) return [];

  const preset = PRESETS[state.motion.preset] ?? PRESET_LIST[0];
  const ease = makeEase(state.motion.ease);
  const params = resolveParams(state);
  const stage = opts.stageOverride ?? stageDims(state.stage.ratio);
  const mode = currentLayoutMode(state);
  const bleed = state.containers?.mode === "bleed";

  // Presets con geometría propia (ej. Cascade conveyor): ubican cada card
  // directo sobre la caja interior, sin pasar por weight→layout.
  if (typeof preset.place === "function") {
    const inner = innerBox(stage, state.stage?.padding ?? 0);
    const gapPx = (bleed ? 0 : state.containers?.gap ?? 0) * MIN_SIDE;
    const geom = { stage, inner, gap: gapPx };
    const frame = new Array(N);
    for (let i = 0; i < N; i++) {
      const r = preset.place(t01, i, N, params, ease, geom);
      frame[i] = {
        id: palette[i].id,
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        hex: palette[i].hex,
        name: palette[i].name ?? "",
        opacity: clamp(r.opacity ?? 1),
        rotate: r.rotate ?? 0,
        z: r.z ?? i,
      };
    }
    frame.sort((a, b) => a.z - b.z);
    return frame;
  }

  // 1. TRACKS — se resuelven todos antes de tocar el layout.
  const tracks = new Array(N);
  for (let i = 0; i < N; i++) {
    tracks[i] = { ...baseTrack(i), ...preset.track(t01, i, N, params, ease) };
  }

  // 2. LAYOUT — consume los weights emitidos por los tracks.
  const weights = tracks.map((tr) => tr.weight);
  const rects = layout(weights, mode, stage, {
    padding: state.stage?.padding ?? 0,
    gap: bleed ? 0 : (state.containers?.gap ?? 0),
  });

  // 3. COMPOSITOR — rect de layout + deltas del track = rect real del frame.
  const frame = new Array(N);
  for (let i = 0; i < N; i++) {
    const tr = tracks[i];
    const a = rects[clamp(tr.slotA, 0, N - 1) | 0] ?? rects[i];
    const b = rects[clamp(tr.slotB, 0, N - 1) | 0] ?? rects[i];
    const home = lerpRect(a, b, tr.slotBlend);

    const w0 = home.w;
    const h0 = home.h;
    const s = tr.scale * lerp(1, tr.pileScale, tr.collapse);

    // Centro en el espacio de layout, respetando el pivote de escala.
    const gridCx = home.x + tr.pivotX * w0 + w0 * (0.5 - tr.pivotX) * s;
    const gridCy = home.y + tr.pivotY * h0 + h0 * (0.5 - tr.pivotY) * s;

    // Centro apilado (para Stack u otros combos con collapse).
    const pileCx = stage.w / 2 + tr.pileDX * stage.w;
    const pileCy = stage.h / 2 + tr.pileDY * stage.h;

    const cx = lerp(gridCx, pileCx, tr.collapse) + tr.dx * stage.w;
    const cy = lerp(gridCy, pileCy, tr.collapse) + tr.dy * stage.h;

    const w = w0 * s;
    const h = h0 * s;

    frame[i] = {
      id: palette[i].id,
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      hex: palette[i].hex,
      name: palette[i].name ?? "",
      opacity: clamp(tr.opacity),
      rotate: tr.rotate + tr.pileRot * tr.collapse,
      z: tr.z,
    };
  }

  // El compositor ordena por z y así se dibuja.
  frame.sort((p, q) => p.z - q.z);
  return frame;
}
