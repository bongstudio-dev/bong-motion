// Los 6 presets del MVP. Cada uno es un loop cerrado escrito en función de
// t01 ∈ [0, 1). Un preset describe MOVIMIENTO, no posición final.
//
// track(t01, i, N, params, ease) → salida parcial de track. El compositor
// (getFrame) rellena los defaults y hace la geometría, así el track nunca
// necesita saber dónde cayó la card. Eso desacopla track de layout: por eso
// cascade-sobre-grid o scale-sobre-row salen gratis.

import { clamp, lerp, mod1, circularDist, triangle } from "../utils/math.js";

// Defaults de una salida de track. i entra como slot/z inicial.
export function baseTrack(i) {
  return {
    weight: 1,
    slotA: i,
    slotB: i,
    slotBlend: 0,
    dx: 0, // fracción del ancho del stage
    dy: 0, // fracción del alto del stage
    scale: 1,
    rotate: 0, // grados
    opacity: 1,
    z: i,
    collapse: 0, // 0 = en su rect de layout, 1 = apilado al centro
    pileDX: 0,
    pileDY: 0,
    pileRot: 0,
    pileScale: 1,
    pivotX: 0.5,
    pivotY: 0.5,
  };
}

// Reparte in → hold → out sobre un ciclo [0,1) según holdRatio.
function phaseSplit(holdRatio) {
  const hold = clamp(holdRatio, 0, 0.96);
  const ramp = (1 - hold) / 2;
  return { inEnd: Math.max(1e-4, ramp), outStart: 1 - Math.max(1e-4, ramp) };
}

// Pulso suave con meseta: 1 en el centro, cae a 0 en el borde de la ventana.
function pulse(d, hw, holdRatio, ease) {
  const inner = hw * clamp(holdRatio, 0, 0.98);
  if (d <= inner) return 1;
  if (d >= hw) return 0;
  return 1 - ease((d - inner) / (hw - inner));
}

const hash01 = (n) => {
  const s = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return s - Math.floor(s);
};

// 1. EXPAND — un color toma el peso máximo y el resto se comprime; el foco
//    avanza por índice. Va sobre row o column.
const expand = {
  id: "expand",
  name: "Expand",
  defaultLayout: "row",
  layouts: ["row", "column"],
  params: {
    maxWeight: 4,
    minWeight: 1,
    holdRatio: 0.6,
    direction: "forward",
  },
  schema: [
    { key: "maxWeight", label: "Peso máx", min: 1.5, max: 8, step: 0.1 },
    { key: "minWeight", label: "Peso mín", min: 0.2, max: 2, step: 0.1 },
    { key: "holdRatio", label: "Hold", min: 0, max: 0.95, step: 0.01 },
    {
      key: "direction",
      label: "Dirección",
      type: "select",
      options: [
        { value: "forward", label: "Forward" },
        { value: "pingpong", label: "Ping-pong" },
      ],
    },
  ],
  track(t, i, N, p, ease) {
    let dIdx;
    if (p.direction === "pingpong") {
      const f = triangle(t) * (N - 1);
      dIdx = Math.abs(f - i);
    } else {
      dIdx = circularDist(t, i / N) * N;
    }
    const activation = pulse(dIdx, 1, p.holdRatio, ease);
    const weight = lerp(p.minWeight, p.maxWeight, activation);
    return { weight: Math.max(0.05, weight) };
  },
};

// 2. WAVE — todos los pesos oscilan con una senoidal desfasada por índice.
//    El loop más natural. Sin ease: la sinusoide pura empalma sola.
const wave = {
  id: "wave",
  name: "Wave",
  defaultLayout: "row",
  layouts: ["row", "column"],
  params: { amplitude: 0.6, phaseOffset: 0.15, cycles: 1 },
  schema: [
    { key: "amplitude", label: "Amplitud", min: 0, max: 0.95, step: 0.01 },
    { key: "phaseOffset", label: "Desfase", min: 0, max: 1, step: 0.01 },
    { key: "cycles", label: "Ciclos", min: 1, max: 4, step: 1 },
  ],
  track(t, i, N, p) {
    const cycles = Math.max(1, Math.round(p.cycles)); // entero → cierra el loop
    const w = 1 + p.amplitude * Math.sin(2 * Math.PI * (cycles * t + i * p.phaseOffset));
    return { weight: Math.max(0.05, w) };
  },
};

// 3. CASCADE — conveyor vertical con slot de héroe fijo arriba. La card
//    principal se agranda arriba, se sostiene, y al pasar el turno se encoge y
//    se desliza HACIA ARRIBA hasta salir de cuadro (desaparece), mientras la
//    siguiente crece hacia el slot y toda la cola sube un lugar. Cíclico.
//
//    Usa `place` (placer dedicado) en vez de track: la geometría de héroe +
//    cola con scroll no encaja en el modelo genérico weight→layout. Por eso
//    getFrame le da la caja interior y este preset ubica cada card directo.
const cascade = {
  id: "cascade",
  name: "Cascade",
  defaultLayout: "column",
  layouts: ["column"],
  params: {
    topHeight: 0.36,
    sizeDecay: 0.66,
    taper: 1,
    holdRatio: 0.62,
    fade: 0.7,
    direction: "up",
  },
  schema: [
    { key: "topHeight", label: "Altura tope", min: 0.22, max: 0.55, step: 0.01 },
    { key: "sizeDecay", label: "Reducción x card", min: 0.45, max: 0.92, step: 0.01 },
    { key: "taper", label: "Ancho decreciente", min: 0, max: 1, step: 0.05 },
    { key: "holdRatio", label: "Hold", min: 0, max: 0.9, step: 0.01 },
    { key: "fade", label: "Fade in/out", min: 0, max: 1, step: 0.05 },
    {
      key: "direction",
      label: "Dirección",
      type: "select",
      options: [
        { value: "up", label: "Arriba" },
        { value: "down", label: "Abajo" },
      ],
    },
  ],
  place(t, i, N, p, ease, geom) {
    const { inner, gap } = geom;
    const dir = p.direction === "down" ? -1 : 1;
    const H0 = inner.h * p.topHeight; // alto de la card de arriba (rango 1)
    const W0 = inner.w; // ancho de la card de arriba (full)
    const k = clamp(p.sizeDecay, 0.3, 0.98); // factor de reducción por rango
    const taper = clamp(p.taper ?? 1, 0, 1);
    const hold = clamp(p.holdRatio, 0, 0.95);
    const fade = clamp(p.fade ?? 0.7, 0, 1); // suavidad del fade in/out

    // Avance con meseta: la cola queda quieta durante holdRatio y luego avanza
    // exactamente un lugar (eased). Continuo entre pasos → el loop cierra.
    const s = t * N;
    const sFloor = Math.floor(s);
    const f = s - sFloor;
    const adv = f <= hold ? 0 : ease((f - hold) / (1 - hold));
    const sw = sFloor + adv;

    // Rango continuo: 1 = card de arriba (la más grande), ≥2 = decrecen hacia
    // abajo, <1 = carril de salida (sube y desaparece).
    const cr = (((i - sw) % N) + N) % N;

    // Escala geométrica: pico en cr=1, decae hacia abajo (cola) y hacia arriba
    // (salida). alto y ancho achican juntos (taper regula el ancho).
    const sz = k ** Math.abs(cr - 1);
    const h = H0 * sz;
    const w = W0 * lerp(1, sz, taper);

    let top;
    let opacity;
    if (cr >= 1) {
      // Acumulado de alturas decaídas desde el tope.
      const rr = cr - 1;
      const cumH =
        Math.abs(1 - k) < 1e-6 ? H0 * rr : (H0 * (1 - k ** rr)) / (1 - k);
      top = cumH + rr * gap;
      // Fade-in al entrar por abajo. Con fade=0 → corte seco en el borde.
      const band = Math.max(1e-3, H0 * fade);
      opacity = clamp((inner.h - top) / band, 0, 1);
    } else {
      // Carril de salida: sube y desaparece por arriba.
      top = lerp(-H0 * 1.1, 0, cr);
      // Con fade=0 sale por clipping (opacidad 1); con fade alto empieza a
      // desvanecer antes.
      opacity = fade < 1e-3 ? 1 : clamp(cr / fade, 0, 1);
    }

    // 'up' (referencia) usa el tope tal cual; 'down' refleja verticalmente.
    const y = dir > 0 ? inner.y + top : inner.y + inner.h - (top + h);

    return {
      x: inner.x,
      y,
      w,
      h,
      opacity: clamp(opacity),
      z: N - cr, // el que sale / el tope quedan por encima
    };
  },
};

// 4. SCALE — las cards crecen de 0 a 1, se sostienen y vuelven a 0, con stagger.
const scale = {
  id: "scale",
  name: "Scale",
  defaultLayout: "grid",
  layouts: ["grid", "row", "column"],
  params: { stagger: 0.07, holdRatio: 0.5, origin: "center", overshoot: 0.15 },
  schema: [
    { key: "stagger", label: "Stagger", min: 0, max: 0.4, step: 0.005 },
    { key: "holdRatio", label: "Hold", min: 0, max: 0.9, step: 0.01 },
    { key: "overshoot", label: "Overshoot", min: 0, max: 0.6, step: 0.01 },
    {
      key: "origin",
      label: "Origen",
      type: "select",
      options: [
        { value: "center", label: "Centro" },
        { value: "corner", label: "Esquina" },
        { value: "random", label: "Random" },
      ],
    },
  ],
  track(t, i, N, p, ease) {
    const local = mod1(t + i * p.stagger);
    const { inEnd, outStart } = phaseSplit(p.holdRatio);
    let s;
    let opacity;
    if (local < inEnd) {
      const q = ease(local / inEnd);
      s = q + p.overshoot * 4 * q * (1 - q); // bulto de overshoot, vuelve a 1
      opacity = q;
    } else if (local < outStart) {
      s = 1;
      opacity = 1;
    } else {
      const q = ease((local - outStart) / (1 - outStart));
      s = 1 - q;
      opacity = 1 - q;
    }
    let pivotX = 0.5;
    let pivotY = 0.5;
    if (p.origin === "corner") {
      pivotX = 0;
      pivotY = 0;
    } else if (p.origin === "random") {
      pivotX = hash01(i + 1) < 0.5 ? 0 : 1;
      pivotY = hash01(i + 7) < 0.5 ? 0 : 1;
    }
    return { scale: Math.max(0, s), opacity, pivotX, pivotY, z: i + opacity };
  },
};

// 5. STACK — llegan apiladas al centro, se despliegan a grilla, se sostienen y
//    vuelven a apilarse. Necesita z por card para que la oclusión sea correcta.
const stack = {
  id: "stack",
  name: "Stack",
  defaultLayout: "grid",
  layouts: ["grid", "row", "column"],
  params: { stagger: 0.06, pileOffset: 0.018, pileRotation: 6, holdRatio: 0.5 },
  schema: [
    { key: "stagger", label: "Stagger", min: 0, max: 0.3, step: 0.005 },
    { key: "pileOffset", label: "Offset pila", min: 0, max: 0.06, step: 0.002 },
    { key: "pileRotation", label: "Giro pila", min: 0, max: 20, step: 0.5 },
    { key: "holdRatio", label: "Hold", min: 0, max: 0.9, step: 0.01 },
  ],
  track(t, i, N, p, ease) {
    const local = mod1(t + i * p.stagger);
    const { inEnd, outStart } = phaseSplit(p.holdRatio);
    let deployed;
    if (local < inEnd) deployed = ease(local / inEnd);
    else if (local < outStart) deployed = 1;
    else deployed = 1 - ease((local - outStart) / (1 - outStart));
    const c = i - (N - 1) / 2; // índice centrado para apilar simétrico
    return {
      collapse: 1 - deployed,
      pileDX: c * p.pileOffset,
      pileDY: c * p.pileOffset,
      pileRot: c * p.pileRotation,
      pileScale: 1,
      z: i,
    };
  },
};

// 6. SWAP — reordenamiento cíclico: cada card avanza una posición por paso.
//    Tras N pasos el orden vuelve al original y el loop cierra.
const swap = {
  id: "swap",
  name: "Swap",
  defaultLayout: "row",
  layouts: ["row", "column"],
  params: { stepsPerCycle: 0, arcHeight: 0.14 },
  schema: [
    // stepsPerCycle 0 = auto (N). Se fuerza a múltiplo de N para cerrar el loop.
    { key: "stepsPerCycle", label: "Pasos (0=auto)", min: 0, max: 12, step: 1 },
    { key: "arcHeight", label: "Arco", min: 0, max: 0.4, step: 0.01 },
  ],
  track(t, i, N, p, ease) {
    const requested = Math.round(p.stepsPerCycle) || N;
    const steps = Math.max(1, Math.round(requested / N)) * N; // múltiplo de N
    const prog = t * steps;
    const step = Math.floor(prog);
    const fe = ease(prog - step);
    return {
      slotA: (i + step) % N,
      slotB: (i + step + 1) % N,
      slotBlend: fe,
      dy: -p.arcHeight * Math.sin(Math.PI * fe),
      z: fe,
    };
  },
};

export const PRESETS = { expand, wave, cascade, scale, stack, swap };
export const PRESET_LIST = [expand, wave, cascade, scale, stack, swap];
