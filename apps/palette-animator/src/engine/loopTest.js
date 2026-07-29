// Contrato del loop, innegociable: getFrame(0) === getFrame(1).
// Test que conviene tener desde el día uno: comparar getFrame(0) contra
// getFrame(0.9999) con tolerancia mínima. Si no cierran, el preset está mal.
//
// Matiz honesto: los presets de entrada (Cascade/Scale/Stack) tienen un
// "teletransporte" fuera de cuadro que es invisible porque ocurre con
// opacidad ~0. Por eso el delta de posición se pondera por opacidad: lo que
// no se ve no rompe el loop.

import { getFrame } from "./getFrame.js";
import { stageDims } from "./layout.js";

export function loopClosure(state, eps = 1e-4) {
  const stage = stageDims(state.stage.ratio);
  const minSide = Math.min(stage.w, stage.h);
  const a = getFrame(0, state);
  const b = getFrame(1 - eps, state);

  const byId = new Map(b.map((f) => [f.id, f]));
  let maxPos = 0; // delta de posición visible, en fracción del lado menor
  let maxOpacity = 0;

  // Una card totalmente fuera del stage no se ve (el canvas la recorta), así
  // que su visibilidad efectiva es 0 aunque su opacidad sea 1.
  const offStage = (f) =>
    f.x + f.w <= 0 || f.x >= stage.w || f.y + f.h <= 0 || f.y >= stage.h;

  for (const fa of a) {
    const fb = byId.get(fa.id);
    if (!fb) continue;
    const visA = offStage(fa) ? 0 : fa.opacity;
    const visB = offStage(fb) ? 0 : fb.opacity;
    const vis = Math.max(visA, visB);
    const dCenter =
      (Math.abs(fa.x + fa.w / 2 - (fb.x + fb.w / 2)) +
        Math.abs(fa.y + fa.h / 2 - (fb.y + fb.h / 2))) /
      minSide;
    const dSize = (Math.abs(fa.w - fb.w) + Math.abs(fa.h - fb.h)) / minSide;
    // Ponderado por visibilidad: un teletransporte invisible no cuenta.
    maxPos = Math.max(maxPos, (dCenter + dSize) * vis);
    maxOpacity = Math.max(maxOpacity, Math.abs(visA - visB));
  }

  const closes = maxPos < 0.01 && maxOpacity < 0.02;
  return { closes, maxPos, maxOpacity };
}
