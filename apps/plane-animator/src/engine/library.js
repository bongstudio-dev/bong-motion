// Librería de presets de fábrica, agrupados por template.
//
// Un preset guarda la RECETA de movimiento: template + params + timing + fov +
// encuadre. No guarda ratio, fondo ni las guías (safe area, safe frames): el
// formato de salida y las ayudas de trabajo son del usuario, no del preset.
//
// El `fov` sí entra porque cambia el look de forma dramática — un orbit de
// radio grande con fov 45 deja todo fuera de cuadro y con fov 90 se convierte
// en un túnel. Todos los presets lo declaran, así que aplicar uno después de
// otro nunca hereda la perspectiva del anterior.
//
// Cada preset está verificado por scripts/library-test.mjs: geometría válida,
// planos dentro de cuadro y un número de ciclos que cierra el loop.

const EASE_SNAP = [0.87, 0, 0.13, 1]; // expoInOut: "pisa" un paso por ciclo
const EASE_SOFT = [0.65, 0, 0.35, 1];
const EASE_LINEAR = [0, 0, 1, 1];

const timing = (duration, cycles, ease = EASE_SNAP, extra = {}) => ({
  duration,
  cycles,
  stagger: 0,
  delay: 0,
  direction: "forward",
  ease,
  ...extra,
});

export const LIBRARY = [
  {
    template: "carousel",
    variants: [
      {
        id: "carousel-fila",
        name: "Fila",
        fov: 45,
        params: {
          direction: "left", count: 6, planeSize: 620, planeRatio: "4:5",
          gap: 48, slotsPerCycle: 1, depth: 140, scaleCenter: 0.12,
          fade: 1, tilt: "off", cornerRadius: 24, offsetX: 0, offsetY: 0,
          solo: false,
        },
        timing: timing(2.4, 6),
      },
      {
        // El preset que trajiste: columna vertical con los planos alternados.
        id: "carousel-columna",
        name: "Columna",
        fov: 90,
        params: {
          direction: "up", count: 5, planeSize: 330, planeRatio: "4:5",
          gap: 36, slotsPerCycle: 1, depth: 680, scaleCenter: 0.84,
          fade: 1, tilt: "alternate", tiltAngle: 0, cornerRadius: 0,
          offsetX: 0, offsetY: 0, solo: false,
        },
        timing: timing(1.2, 3),
      },
      {
        id: "carousel-coverflow",
        name: "Coverflow",
        fov: 55,
        params: {
          direction: "left", count: 7, planeSize: 520, planeRatio: "1:1",
          gap: 30, slotsPerCycle: 1, depth: 420, scaleCenter: 0.35,
          fade: 1, tilt: "fan", tiltAngle: 52, cornerRadius: 16,
          offsetX: 0, offsetY: 0, solo: false,
        },
        timing: timing(1.6, 4),
      },
      {
        id: "carousel-cinta",
        name: "Cinta",
        fov: 35,
        params: {
          direction: "left", count: 10, planeSize: 380, planeRatio: "4:5",
          gap: 24, slotsPerCycle: 1, depth: 0, scaleCenter: 0,
          fade: 1, tilt: "off", cornerRadius: 8, offsetX: 0, offsetY: 0,
          solo: false,
        },
        // Ease lineal: el desplazamiento es continuo, sin pisadas.
        timing: timing(3.2, 10, EASE_LINEAR),
      },
      {
        id: "carousel-foco",
        name: "Foco",
        fov: 50,
        params: {
          direction: "left", count: 6, planeSize: 700, planeRatio: "4:5",
          gap: 120, slotsPerCycle: 1, depth: 520, scaleCenter: 0.5,
          fade: 1, tilt: "uniform", tiltAngle: 14, cornerRadius: 32,
          offsetX: 0, offsetY: 0, solo: false,
        },
        timing: timing(2, 6, EASE_SNAP),
      },
    ],
  },
  {
    template: "orbit",
    variants: [
      {
        id: "orbit-anillo",
        name: "Anillo",
        fov: 45,
        params: {
          count: 8, radius: 640, planeSize: 420, planeRatio: "4:5",
          facing: "outward", tiltX: 12, yWobble: 0, wobbleFreq: 2,
          stepsPerCycle: 1, fade: 0.4, cornerRadius: 20,
        },
        timing: timing(1.4, 8),
      },
      {
        // El preset que trajiste: el anillo es tan grande que la cámara queda
        // adentro y se ve como un túnel.
        id: "orbit-tunel",
        name: "Túnel",
        fov: 90,
        params: {
          count: 7, radius: 1520, planeSize: 1000, planeRatio: "4:5",
          facing: "outward", tiltX: 12, yWobble: 0, wobbleFreq: 1,
          stepsPerCycle: 4, fade: 0.03, cornerRadius: 66,
        },
        timing: timing(3, 6),
      },
      {
        id: "orbit-carrusel",
        name: "Carrusel",
        fov: 50,
        params: {
          count: 9, radius: 720, planeSize: 460, planeRatio: "4:5",
          facing: "billboard", tiltX: 0, yWobble: 0, wobbleFreq: 2,
          stepsPerCycle: 1, fade: 0.55, cornerRadius: 18,
        },
        timing: timing(1.3, 9),
      },
      {
        id: "orbit-satelites",
        name: "Satélites",
        fov: 60,
        params: {
          count: 12, radius: 700, planeSize: 240, planeRatio: "1:1",
          facing: "billboard", tiltX: 42, yWobble: 180, wobbleFreq: 3,
          stepsPerCycle: 1, fade: 0.5, cornerRadius: 120,
        },
        timing: timing(1.1, 12),
      },
    ],
  },
  {
    template: "flip",
    variants: [
      {
        // El preset que trajiste.
        id: "flip-simple",
        name: "Flip",
        fov: 90,
        params: {
          axis: "y", layout: "single", count: 4, cols: 2, planeSize: 520,
          planeRatio: "4:5", gap: 40, backAsset: "next", flipsPerCycle: 1,
          cornerRadius: 28,
        },
        timing: timing(1.2, 3),
      },
      {
        id: "flip-grilla",
        name: "Grilla",
        fov: 45,
        params: {
          axis: "y", layout: "grid", count: 4, cols: 2, planeSize: 440,
          planeRatio: "4:5", gap: 36, backAsset: "next", flipsPerCycle: 1,
          cornerRadius: 20,
        },
        // El stagger hace que las cuatro no giren a la vez: se lee como onda.
        timing: timing(1.6, 4, EASE_SNAP, { stagger: 0.08 }),
      },
      {
        id: "flip-persiana",
        name: "Persiana",
        fov: 55,
        params: {
          axis: "x", layout: "grid", count: 3, cols: 1, planeSize: 760,
          planeRatio: "16:9", gap: 24, backAsset: "next", flipsPerCycle: 1,
          cornerRadius: 12,
        },
        timing: timing(1.8, 6, EASE_SNAP, { stagger: 0.12 }),
      },
    ],
  },
  {
    template: "deck",
    variants: [
      {
        id: "deck-mazo",
        name: "Mazo",
        fov: 45,
        params: {
          count: 6, planeSize: 720, planeRatio: "4:5", depthGap: 90,
          offsetStep: 26, rotJitter: 3, exitDistance: 560, exitRot: 10,
          fade: 0.5, cornerRadius: 28,
        },
        timing: timing(1.4, 6),
      },
      {
        id: "deck-baraja",
        name: "Baraja",
        fov: 50,
        params: {
          count: 8, planeSize: 620, planeRatio: "4:5", depthGap: 40,
          offsetStep: 74, rotJitter: 12, exitDistance: 700, exitRot: 32,
          fade: 0.35, cornerRadius: 20,
        },
        timing: timing(1.1, 8),
      },
      {
        id: "deck-pila",
        name: "Pila",
        fov: 38,
        params: {
          count: 7, planeSize: 780, planeRatio: "1:1", depthGap: 150,
          offsetStep: 0, rotJitter: 0, exitDistance: 900, exitRot: 0,
          fade: 0.7, cornerRadius: 0,
        },
        // Sin jitter el mazo cierra en un solo ciclo por carta.
        timing: timing(1.2, 7),
      },
    ],
  },
  {
    template: "parallax",
    variants: [
      {
        id: "parallax-capas",
        name: "Capas",
        fov: 45,
        params: {
          direction: "left", count: 5, planeSize: 820, planeRatio: "4:5",
          depthSpread: 900, laps: 2, speedFalloff: 0.5, depthScale: 0.6,
          crossSpread: 260, fade: 0.45, cornerRadius: 24,
        },
        timing: timing(4, 1, EASE_LINEAR),
      },
      {
        id: "parallax-profundo",
        name: "Profundo",
        fov: 70,
        params: {
          direction: "left", count: 8, planeSize: 900, planeRatio: "4:5",
          depthSpread: 2000, laps: 3, speedFalloff: 0.75, depthScale: 0.35,
          crossSpread: 420, fade: 0.7, cornerRadius: 16,
        },
        timing: timing(6, 1, EASE_LINEAR),
      },
      {
        id: "parallax-lluvia",
        name: "Lluvia",
        fov: 55,
        params: {
          direction: "down", count: 9, planeSize: 460, planeRatio: "4:5",
          depthSpread: 1400, laps: 2, speedFalloff: 0.6, depthScale: 0.5,
          crossSpread: 520, fade: 0.55, cornerRadius: 10,
        },
        timing: timing(5, 1, EASE_LINEAR),
      },
    ],
  },
  {
    template: "tunnel",
    variants: [
      {
        // "Túnel" ya es un preset de orbit: acá el nombre es Corredor.
        id: "tunnel-corredor",
        name: "Corredor",
        fov: 45,
        params: {
          count: 6, planeSize: 0.62, planeRatio: "4:5", zGap: 0.6,
          direction: "toward", slotsPerCycle: 1, spread: 0.34, seed: 7,
          rotate: 6, fadeIn: 0.35, cornerRadius: 0.022,
        },
        timing: timing(2.6, 6),
      },
      {
        // Muchas cards chicas y muy dispersas: pasan de a montones por los
        // costados en vez de taparte el cuadro de a una.
        id: "tunnel-enjambre",
        name: "Enjambre",
        fov: 62,
        params: {
          count: 12, planeSize: 0.34, planeRatio: "1:1", zGap: 0.3,
          direction: "toward", slotsPerCycle: 2, spread: 0.8, seed: 21,
          rotate: 24, fadeIn: 0.5, cornerRadius: 0.03,
        },
        timing: timing(2, 6),
      },
      {
        // Al revés y por el centro: las cards se alejan en vez de venir. Sin
        // dispersión ni rotación las cards son intercambiables y el patrón
        // cierra en un ciclo — lo único que pide vueltas son los assets.
        id: "tunnel-pozo",
        name: "Pozo",
        fov: 35,
        params: {
          count: 6, planeSize: 0.86, planeRatio: "9:16", zGap: 0.95,
          direction: "away", slotsPerCycle: 1, spread: 0, seed: 3,
          rotate: 0, fadeIn: 0.22, cornerRadius: 0,
        },
        timing: timing(3.4, 6, EASE_LINEAR),
      },
    ],
  },
  {
    template: "wall",
    variants: [
      {
        id: "wall-muro",
        name: "Muro",
        fov: 45,
        params: {
          rows: 4, cols: 4, planeSize: 0.3, planeRatio: "4:5", gap: 0.03,
          drift: 1, rowDir: "alternate", tiltX: 12, tiltY: -18,
          centerScale: 0.25, edgeFade: 0.35, cornerRadius: 0.014,
        },
        timing: timing(2, 4, EASE_LINEAR),
      },
      {
        // De frente y en una sola tira: la marquesina de toda la vida.
        id: "wall-marquesina",
        name: "Marquesina",
        fov: 40,
        params: {
          rows: 1, cols: 6, planeSize: 0.42, planeRatio: "1:1", gap: 0.02,
          drift: 1, rowDir: "uniform", tiltX: 0, tiltY: 0,
          centerScale: 0, edgeFade: 0.28, cornerRadius: 0.02,
        },
        timing: timing(1.5, 6, EASE_LINEAR),
      },
      {
        // Muy inclinado y con la fila del medio agrandada: el muro se lee como
        // una pared vista de costado.
        id: "wall-pared",
        name: "Pared",
        fov: 62,
        params: {
          rows: 6, cols: 5, planeSize: 0.22, planeRatio: "4:5", gap: 0.018,
          drift: 2, rowDir: "alternate", tiltX: -8, tiltY: 38,
          centerScale: 0.7, edgeFade: 0.5, cornerRadius: 0.01,
        },
        timing: timing(1.6, 5, EASE_LINEAR),
      },
    ],
  },
];

export const VARIANTS_BY_TEMPLATE = Object.fromEntries(
  LIBRARY.map((group) => [group.template, group.variants]),
);

export const ALL_VARIANTS = LIBRARY.flatMap((g) =>
  g.variants.map((v) => ({ ...v, template: g.template })),
);

export const findVariant = (id) => ALL_VARIANTS.find((v) => v.id === id) ?? null;

// Estado completo para previsualizar un preset sin tocar el del usuario: lo que
// consume la miniatura y lo que se aplica al elegirlo.
export function variantState(base, variant, template) {
  return {
    ...base,
    template: {
      id: template,
      params: { ...base.template.params, [template]: variant.params },
    },
    timing: { ...base.timing, ...variant.timing },
    fit: { ...base.fit, ...(variant.fit ?? {}) },
    stage: { ...base.stage, fov: variant.fov ?? 45 },
  };
}
