// Sistema de ease. Función cubicBezier propia: el engine necesita el NÚMERO,
// no una transición del browser. Así el scrub y el export son exactos.

import { clamp } from "../utils/math.js";

// Bezier cúbica con P0=(0,0) y P3=(1,1). x1,y1,x2,y2 son los dos handles.
// Devuelve una función ease(t) que mapea t (eje x) al valor (eje y).
// y puede salirse de [0,1] (curvas 'back' → overshoot); x se resuelve en [0,1].
export function cubicBezier(x1, y1, x2, y2) {
  // Coeficientes de la forma polinómica de Bézier.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  // Dado x, encuentra el parámetro t con Newton-Raphson + bisección de respaldo.
  const solveT = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      if (err > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (t) => {
    const x = clamp(t);
    if (x === 0) return 0;
    if (x === 1) return 1;
    // Atajo lineal cuando los handles están en la diagonal.
    if (x1 === y1 && x2 === y2) return x;
    return sampleY(solveT(x));
  };
}

// Construye un ease a partir de [x1,y1,x2,y2]; tolera valores inválidos.
export function makeEase(bezier) {
  const [x1, y1, x2, y2] = Array.isArray(bezier) ? bezier : [0, 0, 1, 1];
  return cubicBezier(clamp(x1), y1, clamp(x2), y2);
}

// Grid de presets, como el panel de Motion de After Effects.
// Valores estándar (easings.net). 'back' se sale de [0,1] a propósito.
export const EASE_PRESETS = [
  { id: "linear", label: "Linear", value: [0, 0, 1, 1] },
  { id: "quadIn", label: "Quad In", value: [0.11, 0, 0.5, 0] },
  { id: "quadOut", label: "Quad Out", value: [0.5, 1, 0.89, 1] },
  { id: "quadInOut", label: "Quad InOut", value: [0.45, 0, 0.55, 1] },
  { id: "cubicIn", label: "Cubic In", value: [0.32, 0, 0.67, 0] },
  { id: "cubicOut", label: "Cubic Out", value: [0.33, 1, 0.68, 1] },
  { id: "cubicInOut", label: "Cubic InOut", value: [0.65, 0, 0.35, 1] },
  { id: "expoIn", label: "Expo In", value: [0.7, 0, 0.84, 0] },
  { id: "expoOut", label: "Expo Out", value: [0.16, 1, 0.3, 1] },
  { id: "expoInOut", label: "Expo InOut", value: [0.87, 0, 0.13, 1] },
  { id: "backIn", label: "Back In", value: [0.36, 0, 0.66, -0.56] },
  { id: "backOut", label: "Back Out", value: [0.34, 1.56, 0.64, 1] },
  { id: "backInOut", label: "Back InOut", value: [0.68, -0.6, 0.32, 1.6] },
];

// Compara dos beziers para marcar el preset activo en la UI.
export const sameBezier = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === 4 &&
  b.length === 4 &&
  a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
