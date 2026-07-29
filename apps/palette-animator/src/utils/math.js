// Utilidades numéricas puras. Sin estado, sin dependencias.

export const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

// Fase circular: lleva cualquier número al rango [0, 1). Clave para los loops.
export const mod1 = (t) => {
  const r = t % 1;
  return r < 0 ? r + 1 : r;
};

// Distancia circular entre dos fases en [0,1). Máximo 0.5.
export const circularDist = (a, b) => {
  const d = Math.abs(mod1(a) - mod1(b));
  return d > 0.5 ? 1 - d : d;
};

export const smoothstep = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

// Onda triangular 0→1→0 sobre un ciclo, para movimientos ping-pong.
export const triangle = (t) => {
  const x = mod1(t);
  return x < 0.5 ? x * 2 : 2 - x * 2;
};

export const lerpRect = (a, b, t) => {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
  };
};

let idCounter = 0;
export const uid = (prefix = "c") =>
  `${prefix}${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export const round = (v, decimals = 3) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};
