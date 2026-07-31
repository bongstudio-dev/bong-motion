// Modelo de datos + defaults. BRIEF §3 / §6.3.
//
// Cambio deliberado respecto del palette-animator: el TIMING es global y vive
// aparte de los params del template. Ahí todo vivía en `motion.params` y eso
// obliga a reescribir cada preset cuando cambia el modelo de timing.
//
// Se conserva el patrón `mergeState` defensivo tal cual.

import { mergeTextLayers } from "@bong/ui/text";

export const STATE_VERSION = 1;

export function defaultState() {
  return {
    version: STATE_VERSION,

    // localStorage no aguanta imágenes: los assets NO se persisten, se recargan
    // por sesión. El resto del state sí. (IndexedDB queda para v2.)
    assets: [],

    // Capas de texto sobre la pieza. Son texto plano: se persisten enteras.
    texts: [],

    fit: {
      mode: "cover", // 'cover' | 'contain' | 'fitToAsset'
      transition: "morph", // 'morph' | 'lock'
      containBg: "#141416",
    },

    template: {
      id: "carousel",
      // Por template, para no perder el ajuste al cambiar y volver.
      params: {},
    },

    // Global. El template no sabe nada de esto salvo el ease, que le llega ya
    // resuelto como función.
    timing: {
      duration: 4, // segundos de UN ciclo
      cycles: 1, // ciclos que forman la pieza
      stagger: 0, // fracción de ciclo entre plano y plano
      delay: 0,
      direction: "forward", // 'forward' | 'reverse' | 'pingpong'
      ease: [0.65, 0, 0.35, 1],
    },

    stage: {
      ratio: "4:5", // '1:1' | '4:5' | '9:16' | '16:9' | 'custom'
      customW: 1080,
      customH: 1350,
      fov: 45,
      background: "#0A0A0A",
      fps: 30, // 30 | 60
      safeArea: false, // márgenes de Instagram — sólo guía, nunca se exporta
      safeFrames: false, // recorte de los otros ratios sobre el actual
    },

    stitch: {
      enabled: true,
      duration: 0.6,
      ease: [0.65, 0, 0.35, 1],
    },

    export: {
      format: "webm", // 'webm' | 'mp4' | 'gif' | 'png'
      resolution: 1, // 1 = 1080, 2 = 2160
      ratios: ["4:5"], // export por lote multi-ratio
      quality: 0.14, // bits por pixel por frame → bitrate
      name: "plane",
    },
  };
}

const clampNum = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n < min ? min : n > max ? max : n;
};

const bezier = (v, fallback) =>
  Array.isArray(v) && v.length === 4 && v.every((n) => Number.isFinite(n))
    ? v
    : fallback;

// Deep-merge defensivo: garantiza que un estado cargado (localStorage/JSON)
// tenga todas las claves aunque venga de una versión vieja o incompleta.
export function mergeState(loaded) {
  const base = defaultState();
  if (!loaded || typeof loaded !== "object") return base;

  const out = { ...base };
  for (const key of Object.keys(base)) {
    const l = loaded[key];
    if (l === undefined || l === null) continue;
    if (Array.isArray(base[key])) {
      out[key] = Array.isArray(l) ? l : base[key];
    } else if (typeof base[key] === "object") {
      out[key] = { ...base[key], ...l };
    } else {
      out[key] = l;
    }
  }

  // Los assets nunca vuelven de la persistencia: sin píxeles, una entrada de
  // asset es una referencia rota. Quien importe un JSON conserva los que ya
  // tenga cargados en la sesión (lo resuelve el ExportPanel).
  out.assets = [];

  // Las capas de texto sí vuelven, pero rellenando las claves que un state
  // viejo no tenga: la ventana flotante da por hecho que están todas.
  out.texts = mergeTextLayers(loaded.texts);

  // Params por template: objeto de objetos.
  const params = loaded.template?.params;
  out.template = {
    ...base.template,
    ...loaded.template,
    params:
      params && typeof params === "object" && !Array.isArray(params) ? params : {},
  };

  out.timing = {
    ...out.timing,
    duration: clampNum(out.timing.duration, 0.2, 120, base.timing.duration),
    cycles: Math.round(clampNum(out.timing.cycles, 1, 32, 1)),
    stagger: clampNum(out.timing.stagger, -1, 1, 0),
    delay: clampNum(out.timing.delay, -1, 1, 0),
    ease: bezier(out.timing.ease, base.timing.ease),
  };
  out.stitch = { ...out.stitch, ease: bezier(out.stitch.ease, base.stitch.ease) };
  out.stage = {
    ...out.stage,
    fov: clampNum(out.stage.fov, 10, 110, base.stage.fov),
    customW: clampNum(out.stage.customW, 1, 10000, base.stage.customW),
    customH: clampNum(out.stage.customH, 1, 10000, base.stage.customH),
  };
  out.export = {
    ...out.export,
    ratios:
      Array.isArray(out.export.ratios) && out.export.ratios.length
        ? out.export.ratios
        : base.export.ratios,
  };

  out.version = STATE_VERSION;
  return out;
}

// Lo que se serializa en "Guardar como custom": la receta, no los archivos.
// El `fov` entra al preset por la misma razón que en la librería de fábrica:
// cambia el look de forma dramática (un orbit de radio grande con fov 45 deja
// todo fuera de cuadro y con fov 90 es un túnel). Sin él, volver a un preset
// propio heredaría la perspectiva del que estuviera aplicado antes.
// Ratio, fondo y guías NO entran: el formato de salida y las ayudas de trabajo
// son del usuario, no de la receta.
export const presetFromState = (state) => ({
  template: { id: state.template.id, params: state.template.params },
  timing: state.timing,
  fit: state.fit,
  fov: state.stage.fov,
});

export const applyPreset = (state, preset) => ({
  ...state,
  template: { ...state.template, ...preset.template },
  timing: { ...state.timing, ...preset.timing },
  fit: { ...state.fit, ...preset.fit },
  // Los presets guardados antes de que el fov entrara no lo traen: se conserva
  // el actual en vez de saltar a un default.
  stage: { ...state.stage, fov: preset.fov ?? state.stage.fov },
});

export const MAX_ASSETS = 40;
