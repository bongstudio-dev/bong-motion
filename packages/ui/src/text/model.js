// Modelo de las capas de texto. Vive en @bong/ui y no en cada app porque las
// tres tools exportan del MISMO canvas que previsualizan: si cada una tuviera
// su propio modelo, el mismo texto saldría distinto según la herramienta y el
// WYSIWYG dejaría de ser una propiedad de la plataforma.
//
// Las medidas van en px LÓGICOS del stage (1080 de ancho), igual que el resto
// de los renderers: la resolución de export es un multiplicador, nunca una
// unidad.

/* ---------- Vocabularios ---------- */

// Fuentes del sistema comunes + Satoshi. La lista es un atajo: el select se
// completa con las que detecte `queryLocalFonts` y con las que suba el usuario.
export const TEXT_FONTS = [
  { value: "Satoshi", label: "Satoshi" },
  { value: "system-ui", label: "System UI" },
  { value: "Helvetica Neue", label: "Helvetica Neue" },
  { value: "Arial", label: "Arial" },
  { value: "Arial Black", label: "Arial Black" },
  { value: "Avenir Next", label: "Avenir Next" },
  { value: "Futura", label: "Futura" },
  { value: "Gill Sans", label: "Gill Sans" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New (mono)" },
  { value: "Menlo", label: "Menlo (mono)" },
  { value: "Verdana", label: "Verdana" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Impact", label: "Impact" },
];

export const TEXT_WEIGHTS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 700, label: "Bold" },
  { value: 900, label: "Black" },
];

export const TEXT_CASES = [
  { value: "none", label: "Como está" },
  { value: "upper", label: "MAYÚS" },
  { value: "lower", label: "minús" },
  { value: "title", label: "Capital" },
];

export const TEXT_ALIGNS = ["left", "center", "right"];

// Anclas del grid 3×3, en orden de lectura.
export const TEXT_ANCHORS = [
  ["tl", "tc", "tr"],
  ["ml", "mc", "mr"],
  ["bl", "bc", "br"],
];

// Tres ranuras de profundidad. `back` va sobre el fondo y debajo del contenido;
// `middle` y `front` van encima, y se diferencian entre sí — hoy ninguna tool
// tiene una capa de logo intercalada, así que `middle` es el lugar reservado
// para cuando la haya. El orden dentro de una ranura lo da la lista.
export const TEXT_SLOTS = ["back", "middle", "front"];

export const TEXT_SLOT_OPTIONS = [
  { value: "front", label: "Frente" },
  { value: "middle", label: "Medio" },
  { value: "back", label: "Fondo" },
];

// Margen del ancla contra el borde del stage, en fracción del lado menor. Es el
// mismo 6% del safe area de Instagram: un texto pegado al borde no se lee en
// ningún feed.
export const TEXT_MARGIN = 0.06;

/* ---------- Fábrica ---------- */

const uid = () => `t_${Math.random().toString(36).slice(2, 9)}`;

export function createTextLayer(patch = {}) {
  return {
    id: uid(),
    content: "Tu titular",
    visible: true,

    fontFamily: "Satoshi",
    fontWeight: 700,
    size: 100, // px sobre el stage lógico
    lineHeight: 120, // % del tamaño
    tracking: 0, // % del tamaño

    color: "#FFFFFF",
    opacity: 100, // %

    align: "left", // alineación de las líneas DENTRO del bloque
    textCase: "none",

    anchor: "mc", // ancla del bloque en el stage
    offsetX: 0, // % del ancho del stage
    offsetY: 0, // % del alto del stage

    slot: "front",
    ...patch,
  };
}

// Copia con id nuevo y un pequeño desplazamiento, para que el duplicado no
// quede escondido exactamente debajo del original.
export function duplicateTextLayer(text) {
  return {
    ...text,
    id: uid(),
    offsetX: Number((text.offsetX + 2).toFixed(2)),
    offsetY: Number((text.offsetY + 2).toFixed(2)),
  };
}

// Saneado defensivo: un state viejo de localStorage o un JSON importado puede
// venir sin claves nuevas. Mismo criterio que el `mergeState` de cada app.
export function mergeTextLayers(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((t) => t && typeof t === "object")
    .map((t) => ({ ...createTextLayer(), ...t, id: t.id || uid() }));
}

/* ---------- Utilidades de presentación ---------- */

const CASE_FN = {
  none: (s) => s,
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  title: (s) =>
    s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
};

export const applyTextCase = (str, textCase) =>
  (CASE_FN[textCase] ?? CASE_FN.none)(str);

// Etiqueta de la fila en el sidebar: la primera línea, recortada.
export function textLabel(text) {
  const first = (text.content || "").split("\n")[0].trim();
  if (!first) return "Texto sin contenido";
  return first.length > 34 ? `${first.slice(0, 33)}…` : first;
}
