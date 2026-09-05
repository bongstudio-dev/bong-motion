// Los 5 templates del MVP. BRIEF §4.
//
// Se conserva el PATRÓN del `presets.js` del palette-animator (schema
// declarativo que genera la UI solo), no el contenido: acá cada template
// ubica planos en el espacio 3D en vez de repartir pesos en una fila.
//
//   place(t, i, N, params, timing, ease, geom) → { pos, rot, size, opacity, ... }
//
// `t` NO viene envuelto en [0,1): viene en unidades de ciclo (0..cycles), así
// floor(t) cuenta ciclos completos. Eso es lo que permite que el avance de
// assets acumule a lo largo de la pieza en vez de resetearse cada ciclo — que
// es exactamente el caso nuevo del BRIEF §7. (El brief sugiere `mod1(...)` para
// el stagger; con este modelo de cinta infinita el mod1 sobraría y rompería el
// avance multi-ciclo, así que se restó sin envolver.)
//
// El template no sabe nada de stagger ni de assets: recibe su `t` ya desfasado
// y devuelve `assetSlot`, un entero de la secuencia. El compositor resuelve
// `assetIndex = mod(assetSlot, M)`.

import { clamp, lerp, frac, mod, hash01, gcd } from "../utils/math.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const smooth = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export const PLANE_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "3:4", label: "3:4" },
  { value: "5:4", label: "5:4" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

export const ratioWH = (s) => {
  const [a, b] = String(s).split(":").map(Number);
  return a > 0 && b > 0 ? a / b : 0.8;
};

const DIRECTIONS = [
  { value: "left", label: "←" },
  { value: "right", label: "→" },
  { value: "up", label: "↑" },
  { value: "down", label: "↓" },
];

// Avance en slots a lo largo de la pieza. floor(t) son ciclos completos y el
// ease moldea cada ciclo por separado: con `linear` el movimiento es continuo,
// con `expoInOut` queda un carousel que "pisa" un slot por ciclo.
// Como ease(0) = 0 y ease(1) = 1, el avance por ciclo es exactamente `slots`
// — que es lo que hace verificable el contrato de loop del §7.
export function steppedAdvance(t, ease, slots = 1) {
  const c = Math.floor(t);
  return (c + ease(t - c)) * slots;
}

const isHoriz = (dir) => dir === "left" || dir === "right";
// Signo tal que un `advance` creciente mueve los planos en la dirección pedida.
const dirSign = (dir) => (dir === "right" || dir === "up" ? -1 : 1);

/* ------------------------------------------------------------------ */
/* 1. CAROUSEL — el template de referencia                            */
/* ------------------------------------------------------------------ */

const carousel = {
  id: "carousel",
  name: "Carousel",
  supportsFitToAsset: true,
  count: (p) => Math.round(p.count),
  slotsPerCycle: (p) => Math.round(p.slotsPerCycle),
  params: {
    direction: "left",
    count: 6,
    planeSize: 620,
    planeRatio: "4:5",
    gap: 48,
    cornerRadius: 24,
    slotsPerCycle: 1,
    // Default 1 a propósito: con fade 1 la opacidad en el punto de wrap es
    // exactamente 0, así el loop cierra sin depender de que el count y el
    // tamaño dejen los extremos fuera de cuadro.
    fade: 1,
    scaleCenter: 0.12,
    depth: 140,
    tilt: "off",
    tiltAngle: 18,
    offsetX: 0,
    offsetY: 0,
    solo: false,
  },
  schema: [
    { group: "Composición", key: "direction", label: "Dirección", type: "select", options: DIRECTIONS },
    { group: "Composición", key: "count", label: "Cantidad", min: 2, max: 20, step: 1 },
    { group: "Composición", key: "planeSize", label: "Tamaño", min: 100, max: 1400, step: 10, unit: "px" },
    { group: "Composición", key: "planeRatio", label: "Aspect del plano", type: "select", options: PLANE_RATIOS },
    { group: "Composición", key: "gap", label: "Gap", min: 0, max: 400, step: 4, unit: "px" },

    { group: "Movimiento", key: "slotsPerCycle", label: "Avance por ciclo", min: 1, max: 6, step: 1, unit: " slots" },

    { group: "Profundidad", key: "depth", label: "Profundidad", min: 0, max: 900, step: 10, unit: "px" },
    { group: "Profundidad", key: "scaleCenter", label: "Escala del centro", min: 0, max: 1, step: 0.01 },
    { group: "Profundidad", key: "fade", label: "Fade en bordes", min: 0, max: 1, step: 0.01 },

    {
      group: "Forma",
      key: "tilt",
      label: "Tilt",
      type: "select",
      options: [
        { value: "off", label: "Off" },
        { value: "fan", label: "Fan" },
        { value: "uniform", label: "Uniforme" },
        { value: "alternate", label: "Alterno" },
      ],
    },
    {
      group: "Forma",
      key: "tiltAngle",
      label: "Ángulo de tilt",
      min: 0,
      max: 80,
      step: 1,
      unit: "°",
      when: (p) => p.tilt !== "off",
    },
    { group: "Forma", key: "cornerRadius", label: "Corner radius", min: 0, max: 200, step: 2, unit: "px" },

    { group: "Encuadre", key: "offsetX", label: "Offset X", min: -800, max: 800, step: 10, unit: "px" },
    { group: "Encuadre", key: "offsetY", label: "Offset Y", min: -800, max: 800, step: 10, unit: "px" },
    { group: "Encuadre", key: "solo", label: "Solo el central", type: "toggle" },
  ],

  place(t, i, N, p, timing, ease, geom) {
    const horiz = isHoriz(p.direction);
    const axis = horiz ? 0 : 1;
    const sign = dirSign(p.direction);

    const adv = steppedAdvance(t, ease, p.slotsPerCycle);
    const belt = geom.belt(p.gap, axis);

    // El plano i ocupa el índice de cinta más cercano al avance actual. Cuando
    // el avance cruza ±N/2 el plano "salta" al otro extremo: ese salto es el
    // wrap del loop y ocurre en el punto más lejano del centro, o sea fuera de
    // cuadro y/o con opacidad 0.
    const rel = (adv - i) / N;
    const k = Math.round(rel);
    const j = i + N * k;
    const signed = clamp((rel - k) * 2, -1, 1); // -1..1, 0 = centrado
    const e = Math.abs(signed); //  0..1, 1 = wrap

    // Posición por acumulación sobre la cinta (BRIEF §6.5.2). Con tamaños
    // uniformes esto degenera exactamente en (j - adv) * step.
    const u = belt.center(j) - belt.centerAt(adv);

    // fitToAsset: cerca del wrap mezclamos con el tamaño del otro extremo para
    // que el cambio de forma sea continuo aunque el count sea bajo y el wrap
    // llegue a verse. Con `lock` la cinta ya es uniforme por slot y esto es 0.
    const blend = geom.morphs ? smooth((e - 0.7) / 0.3) * 0.5 : 0;
    const sA = geom.size(j);
    const sB = geom.size(j + (signed >= 0 ? N : -N));
    const scale = 1 + p.scaleCenter * smooth(1 - (e * N) / 2);
    const size = [
      lerp(sA[0], sB[0], blend) * scale,
      lerp(sA[1], sB[1], blend) * scale,
    ];

    let opacity = 1 - p.fade * smooth((e - 0.45) / 0.55);
    if (p.solo) opacity *= smooth(1.2 - (e * N) / 2);

    let ang = 0;
    if (p.tilt === "uniform") ang = p.tiltAngle;
    else if (p.tilt === "alternate") ang = p.tiltAngle * (i % 2 ? -1 : 1);
    else if (p.tilt === "fan") ang = p.tiltAngle * sign * signed * (horiz ? 1 : -1);

    const pos = [p.offsetX, p.offsetY, -p.depth * e * e];
    pos[axis] += sign * u;

    const rot = [0, 0, 0];
    if (p.tilt !== "off") rot[horiz ? 1 : 0] = ang * DEG;

    return { pos, rot, size, opacity, radius: p.cornerRadius, assetSlot: j };
  },
};

/* ------------------------------------------------------------------ */
/* 2. DECK — mazo apilado en Z                                        */
/* ------------------------------------------------------------------ */

const deck = {
  id: "deck",
  name: "Deck",
  supportsFitToAsset: true,
  count: (p) => Math.round(p.count),
  slotsPerCycle: () => 1, // sale una carta por ciclo, siempre
  // El jitter viaja CON la carta, no con la posición en la pila: es lo que hace
  // que el mazo se vea vivo. Consecuencia honesta: el patrón de inclinaciones
  // sólo vuelve a repetirse después de `count` ciclos. Con rotJitter en 0 el
  // mazo cierra en uno.
  cycleUnit: (p, N) => (p.rotJitter > 0 ? N : 1),
  params: {
    count: 6,
    planeSize: 720,
    planeRatio: "4:5",
    depthGap: 90,
    offsetStep: 26,
    rotJitter: 3,
    // La carta que sale se acerca a cámara: la perspectiva la agranda sola.
    // Más allá de ~600 tapa el cuadro entero antes de desvanecerse.
    exitDistance: 560,
    exitRot: 10,
    fade: 0.5,
    cornerRadius: 28,
  },
  schema: [
    { group: "Composición", key: "count", label: "Cartas", min: 2, max: 16, step: 1 },
    { group: "Composición", key: "planeSize", label: "Tamaño", min: 100, max: 1400, step: 10, unit: "px" },
    { group: "Composición", key: "planeRatio", label: "Aspect del plano", type: "select", options: PLANE_RATIOS },
    { group: "Composición", key: "depthGap", label: "Separación en Z", min: 0, max: 400, step: 5, unit: "px" },
    { group: "Composición", key: "offsetStep", label: "Desfase del mazo", min: -120, max: 120, step: 2, unit: "px" },
    { group: "Look", key: "rotJitter", label: "Jitter de rotación", min: 0, max: 20, step: 0.5, unit: "°" },
    { group: "Movimiento", key: "exitDistance", label: "Distancia de salida", min: 100, max: 1600, step: 20, unit: "px" },
    { group: "Movimiento", key: "exitRot", label: "Rotación de salida", min: -60, max: 60, step: 1, unit: "°" },
    { group: "Look", key: "fade", label: "Fade en profundidad", min: 0, max: 1, step: 0.01 },
    { group: "Look", key: "cornerRadius", label: "Corner radius", min: 0, max: 200, step: 2, unit: "px" },
  ],

  place(t, i, N, p, timing, ease, geom) {
    const adv = steppedAdvance(t, ease, 1);

    // s ∈ [-1, N-1): posición continua en el mazo. s < 0 es la fase de salida
    // (la carta de adelante vuela hacia cámara y se desvanece); s ≥ 0 es la
    // pila. El epsilon deja el mazo intacto en t = 0 en vez de arrancar con una
    // carta ya saliendo.
    const k = Math.floor((i - adv + 1 - 1e-9) / N);
    const s = i - adv - N * k;
    const j = i - N * k;

    const out = Math.max(0, -s); // 0..1 saliendo
    const depth = Math.max(0, s); // 0 = frente

    const size = geom.size(j);
    const z = out > 0 ? out * p.exitDistance : -depth * p.depthGap;
    // Sembrado por `i` y no por `j`: el índice de cinta crece sin límite, así
    // que hash01(j) nunca se repetiría y el mazo no cerraría NUNCA. Con `i` el
    // jitter viaja igual con la carta y el patrón vuelve cada N ciclos.
    const jitter = (hash01(i * 3.71 + 0.5) * 2 - 1) * p.rotJitter;

    // La carta más profunda entra desvanecida. No es decorativo: mientras una
    // carta sale por adelante, el fondo del mazo queda vacío, y sin este fade
    // el frame final tendría una carta menos que el inicial — el loop no
    // cerraría. Es el mismo truco que el fade de los bordes del carousel.
    const enter = smooth(N - 1 - depth);

    const opacity =
      (1 - out) * enter * (1 - p.fade * smooth(N > 1 ? depth / (N - 1) : 0));

    return {
      pos: [s * p.offsetStep, -s * p.offsetStep * 0.45, z],
      rot: [0, 0, (jitter + out * p.exitRot) * DEG],
      size,
      opacity,
      radius: p.cornerRadius,
      assetSlot: j,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 3. PARALLAX — capas a distinta profundidad y velocidad             */
/* ------------------------------------------------------------------ */

const parallax = {
  id: "parallax",
  name: "Parallax",
  supportsFitToAsset: true,
  count: (p) => Math.round(p.count),
  // Cada capa se lleva su asset puesto y sólo hace wrap: los assets no rotan
  // entre planos, así que el loop cierra siempre en 1 ciclo.
  slotsPerCycle: () => 0,
  params: {
    direction: "left",
    count: 5,
    planeSize: 820,
    planeRatio: "4:5",
    depthSpread: 900,
    laps: 2,
    speedFalloff: 0.5,
    depthScale: 0.6,
    crossSpread: 260,
    fade: 0.45,
    cornerRadius: 24,
  },
  schema: [
    { group: "Composición", key: "direction", label: "Dirección", type: "select", options: DIRECTIONS },
    { group: "Composición", key: "count", label: "Capas", min: 2, max: 16, step: 1 },
    { group: "Composición", key: "planeSize", label: "Tamaño", min: 100, max: 1600, step: 10, unit: "px" },
    { group: "Composición", key: "planeRatio", label: "Aspect del plano", type: "select", options: PLANE_RATIOS },
    { group: "Composición", key: "depthSpread", label: "Rango de profundidad", min: 0, max: 2400, step: 20, unit: "px" },
    { group: "Movimiento", key: "laps", label: "Vueltas por ciclo", min: 1, max: 5, step: 1 },
    { group: "Movimiento", key: "speedFalloff", label: "Caída de velocidad", min: 0, max: 0.9, step: 0.01 },
    { group: "Look", key: "depthScale", label: "Compensar escala", min: 0, max: 1, step: 0.01 },
    { group: "Composición", key: "crossSpread", label: "Dispersión lateral", min: 0, max: 900, step: 10, unit: "px" },
    { group: "Look", key: "fade", label: "Fade en profundidad", min: 0, max: 1, step: 0.01 },
    { group: "Look", key: "cornerRadius", label: "Corner radius", min: 0, max: 200, step: 2, unit: "px" },
  ],

  place(t, i, N, p, timing, ease, geom) {
    const horiz = isHoriz(p.direction);
    const axis = horiz ? 0 : 1;
    const sign = dirSign(p.direction);

    const l = N <= 1 ? 0 : i / (N - 1); // 0 = capa más cercana
    const z = -l * p.depthSpread;

    // Las vueltas por ciclo son ENTERAS. Es lo que hace que capas a distinta
    // velocidad sigan cerrando el loop: cada una vuelve a su punto de partida.
    const laps = Math.max(1, Math.round(p.laps * (1 - p.speedFalloff * l)));
    const adv = steppedAdvance(t, ease, 1);

    // La perspectiva achica las capas de atrás; depthScale las devuelve
    // parcialmente a su tamaño aparente sin matar el parallax.
    const vis = geom.visible(z);
    const persp = vis.h / geom.stage.h;
    const comp = lerp(1, persp, p.depthScale);
    const base = geom.size(i);
    const size = [base[0] * comp, base[1] * comp];

    const travel = (horiz ? vis.w : vis.h) + (horiz ? size[0] : size[1]);
    const ph = frac(hash01(i * 7.13) + adv * laps);

    const pos = [0, 0, z];
    pos[axis] = (ph - 0.5) * travel * sign;
    pos[horiz ? 1 : 0] = (hash01(i * 3.17) * 2 - 1) * p.crossSpread;

    return {
      pos,
      rot: [0, 0, 0],
      size,
      opacity: 1 - p.fade * l,
      radius: p.cornerRadius * comp,
      assetSlot: i,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 4. ORBIT — círculo alrededor del eje Y                             */
/* ------------------------------------------------------------------ */

const orbit = {
  id: "orbit",
  name: "Orbit",
  supportsFitToAsset: true,
  count: (p) => Math.round(p.count),
  // Un ciclo avanza `stepsPerCycle` POSICIONES del anillo, no una vuelta
  // entera: con una vuelta por ciclo el anillo terminaba exactamente donde
  // empezó y el frente repetía siempre la misma imagen.
  //
  // Cada plano se queda con SU asset y nunca lo cambia. En un anillo se ve todo
  // el tiempo y —por la perspectiva— ni siquiera los planos del costado quedan
  // de canto, así que no hay dónde esconder un cambio de textura. En vez de
  // taparlo, no hace falta: girando de a una posición el frente ya muestra la
  // imagen siguiente, y después de una vuelta entera el anillo cierra exacto.
  slotsPerCycle: () => 0,
  cycleUnit: (p, N) => N / gcd(N, Math.max(1, Math.round(p.stepsPerCycle))),
  params: {
    count: 8,
    radius: 640,
    planeSize: 420,
    planeRatio: "4:5",
    facing: "outward",
    tiltX: 12,
    yWobble: 0,
    wobbleFreq: 2,
    stepsPerCycle: 1,
    fade: 0.4,
    cornerRadius: 20,
  },
  schema: [
    { group: "Composición", key: "count", label: "Cantidad", min: 3, max: 24, step: 1 },
    { group: "Composición", key: "radius", label: "Radio", min: 100, max: 1600, step: 10, unit: "px" },
    { group: "Composición", key: "planeSize", label: "Tamaño", min: 60, max: 1000, step: 10, unit: "px" },
    { group: "Composición", key: "planeRatio", label: "Aspect del plano", type: "select", options: PLANE_RATIOS },
    {
      group: "Look",
      key: "facing",
      label: "Orientación",
      type: "select",
      options: [
        { value: "billboard", label: "A cámara" },
        { value: "outward", label: "Hacia afuera" },
        { value: "inward", label: "Hacia el eje" },
      ],
    },
    { group: "Look", key: "tiltX", label: "Tilt del anillo", min: -80, max: 80, step: 1, unit: "°" },
    { group: "Movimiento", key: "yWobble", label: "Wobble en Y", min: 0, max: 600, step: 10, unit: "px" },
    { group: "Movimiento", key: "wobbleFreq", label: "Frecuencia del wobble", min: 1, max: 6, step: 1 },
    { group: "Movimiento", key: "stepsPerCycle", label: "Avance por ciclo", min: 1, max: 24, step: 1, unit: " pos" },
    { group: "Look", key: "fade", label: "Fade en el fondo", min: 0, max: 1, step: 0.01 },
    { group: "Look", key: "cornerRadius", label: "Corner radius", min: 0, max: 200, step: 2, unit: "px" },
  ],

  place(t, i, N, p, timing, ease, geom) {
    const adv = steppedAdvance(t, ease, p.stepsPerCycle);
    // El plano i queda al frente cuando adv ≡ i. Una vuelta entera son N pasos,
    // así que con stepsPerCycle = N se obtiene el giro continuo de antes.
    const a = ((i - adv) / N) * TAU;
    const R = p.radius;

    const x = Math.sin(a) * R;
    const zc = Math.cos(a) * R; // +R = más cerca de cámara
    const y = p.yWobble ? Math.sin(a * Math.round(p.wobbleFreq)) * p.yWobble : 0;

    // Tilt del anillo entero: rotamos (y, z) sobre X. Se ve como una elipse.
    const tx = p.tiltX * DEG;
    const ct = Math.cos(tx);
    const st = Math.sin(tx);

    const rot = [0, 0, 0];
    if (p.facing === "outward") {
      // Euler XYZ = RX·RY: primero el yaw radial, después el tilt del anillo.
      rot[0] = tx;
      rot[1] = a;
    } else if (p.facing === "inward") {
      rot[0] = tx;
      rot[1] = a + Math.PI;
    } else {
      // Billboard real: apuntamos el plano a la posición de la cámara.
      rot[1] = Math.atan2(x, geom.camZ - (y * st + zc * ct));
    }

    const depthN = (zc / R + 1) / 2; // 0 = atrás, 1 = adelante

    // El asset del plano se cambia cuando está A UN CUARTO DE VUELTA del
    // frente (a = −90°). Con facing outward/inward ahí el plano queda de canto
    // a cámara — área visible cero — así que el cambio no se ve. Es el
    // equivalente al wrap fuera de cuadro del carousel: en un anillo se ve todo
    // el tiempo, y el único escondite real es el canto.
    return {
      pos: [x, y * ct - zc * st, y * st + zc * ct],
      rot,
      size: geom.size(i),
      opacity: lerp(1 - p.fade, 1, depthN),
      radius: p.cornerRadius,
      assetSlot: i,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 5. FLIP — 180° revelando la imagen siguiente                       */
/* ------------------------------------------------------------------ */

const flip = {
  id: "flip",
  name: "Flip",
  // Una cara vertical y una horizontal en el mismo plano no cierran (BRIEF §6.5.4).
  supportsFitToAsset: false,
  count: (p) => (p.layout === "single" ? 1 : Math.round(p.count)),
  // Cada media vuelta revela una imagen nueva por plano.
  slotsPerCycle: (p, N) => Math.round(p.flipsPerCycle) * N,
  // La rotación sólo vuelve a cero con un número PAR de medias vueltas.
  cycleUnit: (p) => (Math.round(p.flipsPerCycle) % 2 === 0 ? 1 : 2),
  params: {
    axis: "y",
    layout: "single",
    count: 4,
    cols: 2,
    planeSize: 760,
    planeRatio: "4:5",
    gap: 40,
    backAsset: "next",
    flipsPerCycle: 1,
    cornerRadius: 28,
  },
  schema: [
    {
      group: "Look",
      key: "axis",
      label: "Eje",
      type: "select",
      options: [
        { value: "y", label: "Y (vertical)" },
        { value: "x", label: "X (horizontal)" },
      ],
    },
    {
      group: "Composición",
      key: "layout",
      label: "Layout",
      type: "select",
      options: [
        { value: "single", label: "Único" },
        { value: "grid", label: "Grilla" },
      ],
    },
    { group: "Composición", key: "count", label: "Cantidad", min: 2, max: 16, step: 1, when: (p) => p.layout === "grid" },
    { group: "Composición", key: "cols", label: "Columnas", min: 1, max: 6, step: 1, when: (p) => p.layout === "grid" },
    { group: "Composición", key: "planeSize", label: "Tamaño", min: 100, max: 1600, step: 10, unit: "px" },
    { group: "Composición", key: "planeRatio", label: "Aspect del plano", type: "select", options: PLANE_RATIOS },
    { group: "Composición", key: "gap", label: "Gap", min: 0, max: 300, step: 4, unit: "px", when: (p) => p.layout === "grid" },
    {
      group: "Look",
      key: "backAsset",
      label: "Cara trasera",
      type: "select",
      options: [
        { value: "next", label: "Asset siguiente" },
        { value: "mirror", label: "Mismo, espejado" },
      ],
    },
    { group: "Movimiento", key: "flipsPerCycle", label: "Medias vueltas por ciclo", min: 1, max: 4, step: 1 },
    { group: "Look", key: "cornerRadius", label: "Corner radius", min: 0, max: 200, step: 2, unit: "px" },
  ],

  place(t, i, N, p, timing, ease, geom) {
    const flips = Math.round(p.flipsPerCycle);
    const adv = steppedAdvance(t, ease, flips);
    const n = Math.floor(adv); // medias vueltas completadas
    const even = mod(n, 2) === 0;

    // La textura de una cara sólo se cambia cuando esa cara está oculta: la
    // visible durante la media vuelta n es front si n es par.
    const frontSlot = i + N * (even ? n : n + 1);
    const backSlot = i + N * (even ? n + 1 : n);

    const size = geom.size(i);
    const pos = [0, 0, 0];
    if (p.layout === "grid") {
      const cols = Math.max(1, Math.round(p.cols));
      const rows = Math.ceil(N / cols);
      pos[0] = ((i % cols) - (cols - 1) / 2) * (size[0] + p.gap);
      pos[1] = -(Math.floor(i / cols) - (rows - 1) / 2) * (size[1] + p.gap);
    }

    const rot = [0, 0, 0];
    rot[p.axis === "x" ? 0 : 1] = adv * Math.PI;

    return {
      pos,
      rot,
      size,
      opacity: 1,
      radius: p.cornerRadius,
      assetSlot: frontSlot,
      backSlot: p.backAsset === "mirror" ? null : backSlot,
      mirrorBack: p.backAsset === "mirror",
    };
  },
};

/* ------------------------------------------------------------------ */
/* 6. TUNNEL — cards alineadas en Z que pasan de largo                */
/* ------------------------------------------------------------------ */

// A partir de acá los params espaciales van en unidades RELATIVAS al lado menor
// del frame (SHORT = 1080), no en px. Los templates viejos se quedan en px a
// propósito: migrarlos rompería todos los presets de fábrica y los guardados.
// Los angulares siguen en grados en las ocho familias.

// El túnel se ancla en la CÁMARA, no en z = 0. Es la diferencia con el resto de
// los templates y es deliberada: lo único que define la perspectiva es la
// distancia a cámara, y anclando ahí esa distancia no depende del ratio. Un
// túnel anclado en z = 0 se vería más largo en 9:16 que en 16:9, porque camZ
// sale de stage.h.
//
// Salida: el wrap ocurre cuando la card pasa la cámara, y ahí tapa el cuadro
// entero — no hay forma de esconderlo con encuadre. Así que el túnel reserva un
// último tramo, TUNNEL_EXIT de su profundidad, donde la opacidad ya llegó a 0:
// la card se apaga ANTES de saltar al fondo y el salto no se ve nunca. No es un
// param, es el mecanismo que hace cerrar el loop — el mismo rol que el fade de
// bordes del carousel o el `enter` del deck.
const TUNNEL_EXIT = 0.12; // fracción de la profundidad total

const tunnel = {
  id: "tunnel",
  name: "Tunnel",
  supportsFitToAsset: true,
  // Le dice al compositor que `planeSize` viene en fracción del lado menor.
  relativeUnits: true,
  count: (p) => Math.round(p.count),
  slotsPerCycle: (p) => Math.round(p.slotsPerCycle),
  // La dispersión y la rotación viajan CON la card (semilla por `i`, no por
  // slot): cada una vuela derecho por su propio carril. El precio honesto es
  // que el patrón de carriles sólo vuelve a repetirse cuando cada card volvió a
  // su slot, o sea a los N / gcd(N, avance) ciclos. Con dispersión y rotación
  // en 0 todas las cards son intercambiables y cierra en uno.
  cycleUnit: (p, N) => {
    if (!(p.spread > 0) && !(p.rotate > 0)) return 1;
    return N / gcd(N, Math.max(1, Math.round(p.slotsPerCycle)));
  },
  params: {
    count: 6,
    planeSize: 0.62,
    planeRatio: "4:5",
    zGap: 0.55,
    direction: "toward",
    slotsPerCycle: 1,
    // Con poca dispersión las cards pasan por el centro y tapan el cuadro
    // entera de a una. Con medio lado menor la mayoría sale por los costados,
    // que es de donde viene la sensación de atravesar algo.
    spread: 0.5,
    seed: 7,
    rotate: 6,
    fadeIn: 0.35,
    cornerRadius: 0.022,
  },
  schema: [
    { group: "Composición", key: "count", label: "Cards visibles", min: 3, max: 24, step: 1 },
    { group: "Composición", key: "planeSize", label: "Tamaño", min: 0.1, max: 1.6, step: 0.01, pct: true },
    { group: "Composición", key: "planeRatio", label: "Aspect del plano", type: "select", options: PLANE_RATIOS },
    { group: "Composición", key: "zGap", label: "Separación en Z", min: 0.08, max: 2, step: 0.01, pct: true },

    {
      group: "Movimiento",
      key: "direction",
      label: "Dirección",
      type: "select",
      options: [
        { value: "toward", label: "Hacia cámara" },
        { value: "away", label: "Alejándose" },
      ],
    },
    { group: "Movimiento", key: "slotsPerCycle", label: "Avance por ciclo", min: 1, max: 8, step: 1, unit: " slots" },

    { group: "Forma", key: "spread", label: "Dispersión lateral", min: 0, max: 1.2, step: 0.01, pct: true },
    { group: "Forma", key: "seed", label: "Semilla", min: 0, max: 999, step: 1 },
    { group: "Forma", key: "rotate", label: "Rotación por card", min: 0, max: 45, step: 1, unit: "°" },
    { group: "Forma", key: "cornerRadius", label: "Corner radius", min: 0, max: 0.2, step: 0.002, pct: true },

    { group: "Profundidad", key: "fadeIn", label: "Fade de aparición", min: 0, max: 1, step: 0.01, pct: true },
  ],

  place(t, i, N, p, timing, ease, geom) {
    const S = geom.SHORT;
    const gapZ = Math.max(1, p.zGap * S);
    const D = N * gapZ; // profundidad total del túnel
    const dir = p.direction === "away" ? -1 : 1;

    const adv = steppedAdvance(t, ease, p.slotsPerCycle);

    // q crece con el avance; k es su posición dentro del túnel y w cuántas
    // veces esta card ya dio la vuelta. Cada vuelta se lleva un asset nuevo,
    // igual que el índice de cinta del carousel.
    const q = dir * (adv - i);
    const w = Math.floor(q / N);
    const k = q - N * w; // [0, N): 0 = recién aparecida al fondo
    const j = i + N * w;

    // dist ∈ (near, near + D]: el fondo del túnel está a near + D de la cámara
    // y el punto de wrap a `near`, donde la opacidad ya es 0. La escala la hace
    // la perspectiva sola — acá no se toca el tamaño.
    const near = TUNNEL_EXIT * D;
    const dist = near + (D - k * gapZ);
    const z = geom.camZ - dist;

    const sx = (hash01(i * 12.9898 + p.seed * 7.13) * 2 - 1) * p.spread * S;
    const sy = (hash01(i * 78.233 + p.seed * 3.71 + 11) * 2 - 1) * p.spread * S;
    const rz = (hash01(i * 45.164 + p.seed * 5.17 + 23) * 2 - 1) * p.rotate;

    const travel = near + D - dist; // 0 al aparecer al fondo
    const enter = p.fadeIn > 0 ? smooth(travel / (p.fadeIn * D)) : 1;
    const exit = smooth((dist - near) / near);

    return {
      pos: [sx, sy, z],
      rot: [0, 0, rz * DEG],
      size: geom.size(j),
      opacity: enter * exit,
      radius: p.cornerRadius * S,
      assetSlot: j,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 7. WALL — grilla que deriva y envuelve                             */
/* ------------------------------------------------------------------ */

// La deriva envuelve dentro del ancho de la fila. Si la fila es más ancha que
// el cuadro —el caso normal— el wrap ocurre afuera y no se ve. Si no lo es
// (pocas columnas, cards chicas), este último tramo del recorrido baja la
// opacidad a 0 para que el salto tampoco se vea. Es un seguro, no un look: con
// la grilla por defecto cae fuera de cuadro y nadie lo nota.
const WALL_WRAP_GUARD = 0.06; // fracción del ancho de la fila

const wall = {
  id: "wall",
  name: "Wall",
  // Una grilla con cards de distinto tamaño deja de ser una grilla: el tile es
  // uniforme por definición.
  supportsFitToAsset: false,
  relativeUnits: true,
  count: (p) => Math.max(1, Math.round(p.rows) * Math.round(p.cols)),
  // Cada card se lleva su asset puesto: no rotan entre planos.
  slotsPerCycle: () => 0,
  // La GEOMETRÍA cierra en un ciclo —la deriva es un número entero de tiles y
  // el muro queda idéntico—, pero el contrato del §7 mide también qué imagen
  // quedó en cada posición, y ahí no cierra: después de un ciclo cada columna
  // muestra la imagen de su vecina. Vuelve a cerrar cuando cada card volvió a
  // su columna, o sea a los cols / gcd(cols, deriva) ciclos. Declararlo en 1
  // haría que el badge diga que cierra algo que no cierra.
  cycleUnit: (p) => {
    const cols = Math.max(1, Math.round(p.cols));
    return cols / gcd(cols, Math.max(1, Math.round(p.drift)));
  },
  params: {
    rows: 4,
    cols: 4,
    planeSize: 0.3,
    planeRatio: "4:5",
    gap: 0.03,
    drift: 1,
    rowDir: "alternate",
    tiltX: 12,
    tiltY: -18,
    centerScale: 0.25,
    edgeFade: 0.35,
    cornerRadius: 0.014,
  },
  schema: [
    { group: "Composición", key: "rows", label: "Filas", min: 1, max: 8, step: 1 },
    { group: "Composición", key: "cols", label: "Columnas", min: 1, max: 10, step: 1 },
    { group: "Composición", key: "planeSize", label: "Tamaño", min: 0.06, max: 0.8, step: 0.01, pct: true },
    { group: "Composición", key: "planeRatio", label: "Aspect del plano", type: "select", options: PLANE_RATIOS },
    { group: "Composición", key: "gap", label: "Gap", min: 0, max: 0.2, step: 0.005, pct: true },

    { group: "Movimiento", key: "drift", label: "Deriva por ciclo", min: 1, max: 6, step: 1, unit: " tiles" },
    {
      group: "Movimiento",
      key: "rowDir",
      label: "Sentido por fila",
      type: "select",
      options: [
        { value: "uniform", label: "Uniforme" },
        { value: "alternate", label: "Alterno" },
      ],
    },

    { group: "Forma", key: "tiltX", label: "Inclinación en X", min: -60, max: 60, step: 1, unit: "°" },
    { group: "Forma", key: "tiltY", label: "Inclinación en Y", min: -60, max: 60, step: 1, unit: "°" },
    { group: "Forma", key: "centerScale", label: "Escala de la fila central", min: 0, max: 1.5, step: 0.01 },
    { group: "Forma", key: "cornerRadius", label: "Corner radius", min: 0, max: 0.1, step: 0.002, pct: true },

    { group: "Profundidad", key: "edgeFade", label: "Fade en los bordes", min: 0, max: 1, step: 0.01, pct: true },
  ],

  place(t, i, N, p, timing, ease, geom) {
    const S = geom.SHORT;
    const cols = Math.max(1, Math.round(p.cols));
    const rows = Math.max(1, Math.round(p.rows));
    const r = Math.floor(i / cols);
    const c = i % cols;

    const [cardW, cardH] = geom.size(i);
    const gap = p.gap * S;
    const tileW = cardW + gap;
    const tileH = cardH + gap;
    const rowW = cols * tileW;

    // Filas alternas en sentido contrario: es el rasgo del muro.
    const sign = p.rowDir === "alternate" && r % 2 ? -1 : 1;
    const adv = steppedAdvance(t, ease, Math.round(p.drift));

    const x0 = (c - (cols - 1) / 2) * tileW;
    const y = -(r - (rows - 1) / 2) * tileH;
    // Envuelve dentro del ancho de la fila. Con `drift` entero, un ciclo
    // recorre un número exacto de tiles y cada card vuelve a su lugar.
    const x = mod(x0 + sign * adv * tileW + rowW / 2, rowW) - rowW / 2;

    // La escala de la fila central NO mueve la grilla: el tile sigue siendo el
    // mismo y sólo cambia lo que se dibuja adentro. Si moviera la grilla, las
    // filas dejarían de estar alineadas y el muro se desarmaría.
    const mid = (rows - 1) / 2;
    const dr = rows > 1 ? Math.abs(r - mid) / mid : 0;
    const k = 1 + p.centerScale * smooth(1 - dr);

    // Inclinación del muro entero: se rota la posición con la misma matriz que
    // three le aplica al plano (Euler XYZ = RX·RY), así las cards quedan
    // coplanares con el muro en vez de flotar sueltas sobre él.
    const tx = p.tiltX * DEG;
    const ty = p.tiltY * DEG;
    const sx = Math.sin(ty);
    const pos = [
      x * Math.cos(ty),
      y * Math.cos(tx) + x * sx * Math.sin(tx),
      y * Math.sin(tx) - x * sx * Math.cos(tx),
    ];

    const view = geom.visible(pos[2]);
    const uFrame = view.w > 0 ? Math.abs(pos[0]) / (view.w / 2) : 0;
    const edge =
      p.edgeFade > 0 ? 1 - smooth((uFrame - (1 - p.edgeFade)) / p.edgeFade) : 1;
    const uRow = Math.abs(x) / (rowW / 2);
    const guard = smooth((1 - uRow) / WALL_WRAP_GUARD);

    return {
      pos,
      rot: [tx, ty, 0],
      size: [cardW * k, cardH * k],
      opacity: edge * guard,
      radius: p.cornerRadius * S * k,
      assetSlot: i,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 8. HERO — una card grande que se sostiene y la reemplaza la que sube */
/* ------------------------------------------------------------------ */

// Fase del ciclo repartida entre sostener y transicionar. Devuelve 0 durante
// todo el sostén y recorre 0→1 en la transición, moldeada por el ease global.
// Como vale 0 al principio y 1 al final, el avance por ciclo sigue siendo
// exactamente 1 slot y el contrato del §7 se verifica igual que en el resto.
function heroPhase(t, ease, hold) {
  const c = Math.floor(t);
  const f = t - c;
  const h = clamp(hold, 0, 0.95);
  return { c, ph: f < h ? 0 : ease((f - h) / (1 - h)) };
}

const hero = {
  id: "hero",
  name: "Hero",
  supportsFitToAsset: true,
  relativeUnits: true,
  count: (p) => Math.round(p.count),
  // Una card por ciclo. La vuelta entera por todos los slots es lo que cierra.
  slotsPerCycle: () => 1,
  params: {
    count: 6,
    planeSize: 0.78,
    planeRatio: "4:5",
    holdRatio: 0.55,
    overlap: 0.7,
    arc: 0.18,
    rotate: 8,
    peek: 0.12,
    shadow: true,
    shadowStrength: 0.45,
    cornerRadius: 0.024,
  },
  schema: [
    // Mínimo 3 y no 2: la rotación necesita una saliente, una en el centro y
    // una esperando abajo. Con dos, la misma card tendría que estar saliendo
    // por arriba y esperando abajo al mismo tiempo.
    { group: "Composición", key: "count", label: "Cards", min: 3, max: 16, step: 1 },
    { group: "Composición", key: "planeSize", label: "Escala del hero", min: 0.3, max: 1.4, step: 0.01, pct: true },
    { group: "Composición", key: "planeRatio", label: "Aspect del plano", type: "select", options: PLANE_RATIOS },

    { group: "Movimiento", key: "holdRatio", label: "Sostén del ciclo", min: 0, max: 0.95, step: 0.01, pct: true },
    { group: "Movimiento", key: "overlap", label: "Solapamiento", min: 0, max: 1, step: 0.01, pct: true },
    { group: "Movimiento", key: "arc", label: "Arco de la trayectoria", min: 0, max: 0.8, step: 0.01, pct: true },
    { group: "Movimiento", key: "rotate", label: "Rotación en el pase", min: 0, max: 45, step: 1, unit: "°" },

    { group: "Forma", key: "peek", label: "Peek de la siguiente", min: 0, max: 0.6, step: 0.01, pct: true },
    { group: "Forma", key: "cornerRadius", label: "Corner radius", min: 0, max: 0.1, step: 0.002, pct: true },

    { group: "Look", key: "shadow", label: "Sombra proyectada", type: "toggle" },
    {
      group: "Look",
      key: "shadowStrength",
      label: "Intensidad de la sombra",
      min: 0,
      max: 1,
      step: 0.01,
      pct: true,
      when: (p) => !!p.shadow,
    },
  ],

  place(t, i, N, p, timing, ease, geom) {
    const S = geom.SHORT;
    const { c, ph } = heroPhase(t, ease, p.holdRatio);

    // Solapamiento: con 1 la que sale y la que entra se mueven juntas toda la
    // transición; con 0 primero se va una y recién después llega la otra.
    const ov = clamp(p.overlap);
    const outEnd = (1 + ov) / 2;
    const inStart = (1 - ov) / 2;
    const pOut = clamp(ph / outEnd);
    const pIn = clamp((ph - inStart) / (1 - inStart));

    const sl = mod(i - c, N); // 0 = la que sale, 1 = la que entra, 2+ = en cola
    const j = i - N * Math.floor((i - c) / N);

    const size = geom.size(j);
    const [w, h] = size;
    // Mismo criterio de "fuera de cuadro" que usa el test de loop: el radio
    // circunscrito cubre cualquier rotación, así la saliente se va de verdad.
    // La sombra va más abajo y es un 5% más grande, así que si está encendida
    // el recorrido de salida tiene que alcanzarle a ELLA: si no, la card sale
    // de cuadro y su sombra se queda adentro, y el loop no cierra por 0.2 de
    // opacidad que nadie sabría de dónde salen.
    const shadowOn = !!p.shadow && p.shadowStrength > 0;
    const shOff = h * 0.05;
    const reach = Math.max(w, h) / 2;
    const outReach = shadowOn ? reach * 1.05 + shOff : reach;
    const view = geom.visible(0);
    const exitY = view.h / 2 + outReach * 1.06;
    // peek = cuánto asoma la siguiente por abajo durante el sostén. El punto de
    // partida se mide con el MISMO radio circunscrito que usa el test de loop,
    // más dos píxeles: apoyarlo justo sobre el borde deja el plano exactamente
    // en el umbral del test, y ahí un error de coma flotante decide si cuenta
    // como visible o no. Con peek en 0 tiene que estar escondido sin discusión.
    const restY = -(view.h / 2 + reach + 2) + p.peek * h;

    let y;
    let x;
    let rz;
    let opacity;

    if (sl === 0) {
      // La saliente sube y se va. No se desvanece: sale de cuadro entera.
      y = exitY * pOut;
      x = p.arc * S * Math.sin(Math.PI * pOut);
      rz = p.rotate * pOut;
      opacity = 1;
    } else {
      // La cola entera sube un lugar. `k` es la posición continua en la fila:
      // 0 es el centro, 1 es el lugar de peek, 2 en adelante ya no se ve. Al
      // ser continua no hay ningún salto de rol entre ciclo y ciclo.
      const k = sl - pIn;
      const u = Math.min(k, 1);
      y = restY * u - Math.max(0, k - 1) * h * 0.14;
      // El arco de la que entra abre para el otro lado que el de la que sale:
      // las dos se cruzan en vez de seguirse.
      x = -p.arc * S * Math.sin(Math.PI * u);
      rz = -p.rotate * u;
      opacity = smooth(2 - k);
    }

    const out = {
      pos: [x, y, 0],
      rot: [0, 0, rz * DEG],
      size,
      opacity,
      radius: p.cornerRadius * S,
      assetSlot: j,
    };

    // Sombra proyectada: un plano negro atrás, apenas más grande y corrido
    // hacia abajo. El compositor la agrega como plano propio (`tint`), así el
    // template no toca el renderer ni el schema de nadie más.
    if (shadowOn && opacity > 0.002) {
      // Va en el MISMO z que la card, no atrás: el orden lo resuelve el
      // renderOrder, y un z distinto le daría otro frustum —más ancho, porque
      // está más lejos— que el que usó `exitY` para calcular la salida. Esa
      // diferencia dejaba la sombra adentro del cuadro con la card ya afuera.
      out.shadow = {
        pos: [x + shOff * 0.35, y - shOff, 0],
        size: [w * 1.05, h * 1.05],
        opacity: opacity * p.shadowStrength * 0.55,
        radius: p.cornerRadius * S * 1.05,
      };
    }

    return out;
  },
};

/* ------------------------------------------------------------------ */

export const TEMPLATE_LIST = [carousel, deck, parallax, orbit, flip, tunnel, wall, hero];

export const TEMPLATES = Object.fromEntries(
  TEMPLATE_LIST.map((tpl) => [tpl.id, tpl]),
);

export const DEFAULT_TEMPLATE = "carousel";

// Params efectivos de un template: defaults + lo guardado en el state.
export function templateParams(tpl, saved) {
  return { ...tpl.params, ...(saved ?? {}) };
}

// v2 (documentado, no implementado — BRIEF §4):
// Stack, Grid, Marquee, Scale, Wipe, Flicker, Frames, Stories, Field, Gravity,
// Proximity, Carousel 3D, Wheel, Spin, Globe, Spiral, Tour, Magazine.
