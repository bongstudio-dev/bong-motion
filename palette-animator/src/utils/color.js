// Manejo de color: normalización de hex, contraste por luminancia, parseo masivo.

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// 'fff' → '#FFFFFF'. Acepta con o sin '#', 3 o 6 dígitos. Devuelve null si no valida.
export function normalizeHex(input) {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "");
  if (!HEX_RE.test(raw)) return null;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return `#${full.toUpperCase()}`;
}

export const isValidHex = (input) => normalizeHex(input) !== null;

export function hexToRgb(hex) {
  const norm = normalizeHex(hex) ?? "#000000";
  const n = parseInt(norm.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Luminancia relativa WCAG (0 = negro, 1 = blanco).
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Blanco o negro, el que más contraste da sobre el color dado.
export function contrastColor(hex) {
  const L = relativeLuminance(hex);
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#FFFFFF" : "#000000";
}

// Parseo masivo: '#004831, #0C6347 #20C683' o lista con saltos de línea.
// Extrae todos los hex válidos (3 o 6 dígitos), normaliza y quita duplicados.
export function parsePalette(text) {
  if (typeof text !== "string") return [];
  const tokens = text.match(/#?[0-9a-fA-F]{6}\b|#?[0-9a-fA-F]{3}\b/g) ?? [];
  const seen = new Set();
  const out = [];
  for (const tok of tokens) {
    const norm = normalizeHex(tok);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}
