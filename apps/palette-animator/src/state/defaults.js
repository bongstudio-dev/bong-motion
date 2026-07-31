// Modelo de datos + defaults. `layout.mode` extiende el modelo del brief a
// propósito: es lo que hace que layout y track sean independientes (cascade
// sobre grid, scale sobre row) sin acoplar el preset a una posición final.

import { mergeTextLayers } from "@bong/ui/text";

export const STATE_VERSION = 1;

export function defaultState() {
  return {
    version: STATE_VERSION,

    // Capas de texto libres sobre la pieza. Son otra cosa que `labels`: esos
    // están atados a una card y salen de la paleta; esto es texto de autor.
    texts: [],
    palette: [
      { id: "c1", hex: "#004831", name: "Verde crítico" },
      { id: "c2", hex: "#0C6347", name: "Verde profundo" },
      { id: "c3", hex: "#20C683", name: "Verde medio" },
      { id: "c4", hex: "#7BE3B0", name: "Verde claro" },
      { id: "c5", hex: "#E7F6EE", name: "Verde niebla" },
    ],
    stage: {
      ratio: "4:5", // '1:1' | '4:5' | '16:9' | '9:16'
      background: "#0A0A0A",
      padding: 0.04, // fracción del lado menor
    },
    containers: {
      mode: "card", // 'card' | 'bleed'
      gap: 0.02, // fracción — en bleed se fuerza a 0
      radius: 24, // px sobre el stage de 1080 — en bleed se fuerza a 0
    },
    motion: {
      preset: "expand",
      duration: 6, // segundos del ciclo completo
      ease: [0.65, 0, 0.35, 1],
      params: {},
    },
    layout: {
      mode: "row", // 'row' | 'column' | 'grid' | 'stack'
    },
    labels: {
      show: "active", // 'always' | 'active' | 'never'
      content: "both", // 'name' | 'hex' | 'both'
      size: 34,
      fontFamily: "Satoshi", // familia de la tipografía (sistema o Satoshi)
      fontWeight: 700, // 400 | 500 | 700 | 900
      autoContrast: true,
      color: "#FFFFFF",
      opacityHook: "none", // 'none' | 'prominence' | 'scale'
      verticalRotate: true,
      verticalFactor: 1.35,
    },
    stitch: {
      enabled: true,
      duration: 0.6, // segundos de la transición entre ratios
      ease: [0.65, 0, 0.35, 1],
    },
    export: {
      fps: 30, // 30 | 60
      cycles: 1,
      resolution: 1, // 1 = 1080, 2 = 4K
      format: "webm", // 'webm' | 'gif' | 'png'
    },
  };
}

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
  // Saneo mínimo de la paleta.
  if (Array.isArray(out.palette)) {
    out.palette = out.palette
      .filter((c) => c && typeof c.hex === "string")
      .slice(0, 10)
      .map((c, i) => ({
        id: c.id ?? `c${i + 1}`,
        hex: c.hex,
        name: typeof c.name === "string" ? c.name : "",
      }));
    if (out.palette.length < 2) out.palette = base.palette;
  }
  // Rellena las claves que un state viejo no tenga: la ventana flotante da por
  // hecho que están todas.
  out.texts = mergeTextLayers(loaded.texts);
  out.version = STATE_VERSION;
  return out;
}

export const MIN_COLORS = 2;
export const MAX_COLORS = 10;

// Paleta de reserva para colores nuevos: verdes/neutros del sistema.
export const NEW_COLOR_POOL = [
  "#20C683",
  "#0C6347",
  "#7BE3B0",
  "#004831",
  "#E7F6EE",
  "#12A16B",
  "#0A0A0A",
  "#F5F5F5",
];
