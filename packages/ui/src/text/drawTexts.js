// Rasterizado de las capas de texto sobre un contexto 2D.
//
// Función pura sobre el ctx: no sabe de React ni de qué tool la llama. Las tres
// la invocan desde su ÚNICO camino de dibujo (el mismo que graba el export), y
// el plane-animator la usa contra un canvas 2D suelto que después sube como
// textura — WebGL no dibuja texto, pero el canvas del que sale el archivo sigue
// siendo uno solo.
//
// Todo se dibuja en coordenadas lógicas del stage. El caller fija el transform
// (dpr o multiplicador de resolución) antes de llamar, igual que el resto de
// los renderers.

import { TEXT_MARGIN, applyTextCase } from "./model.js";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Métricas de la fuente ya seteada en el ctx. `fontBoundingBox*` da el alto de
// la caja de la familia (no el del string), que es lo que hace que dos líneas
// con distintas letras compartan interlineado.
function fontMetrics(ctx, size) {
  const m = ctx.measureText("Hg");
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? size * 0.8;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? size * 0.2;
  return { ascent, descent };
}

// El tracking de Canvas 2D agrega espacio DESPUÉS del último carácter y lo suma
// a `measureText`. Sin descontarlo, un texto centrado queda corrido media letra.
function lineWidth(ctx, line, spacing) {
  const w = ctx.measureText(line).width;
  return spacing > 0 ? Math.max(0, w - spacing) : w;
}

// Resuelve dónde cae el bloque y cada una de sus líneas. Lo usan el dibujo y el
// hit-testing del arrastre sobre el stage: si cada uno hiciera su cuenta, el
// recuadro que se agarra y el texto que se ve podrían separarse.
//
// Deja el ctx con la fuente y el tracking ya seteados — el que dibuja los
// necesita, y el que mide los acaba de usar.
function layout(ctx, text, stage) {
  const size = Math.max(1, text.size);
  const lines = applyTextCase(text.content ?? "", text.textCase).split("\n");
  if (!lines.some((l) => l.trim())) return null;

  const family = text.fontFamily || "Satoshi";
  ctx.font = `${text.fontWeight} ${size}px "${family}", ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // `letterSpacing` no existe en todos los browsers: donde falte, el texto sale
  // sin tracking en vez de romper el dibujo.
  const spacing = (size * (text.tracking || 0)) / 100;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  const spacingApplied = "letterSpacing" in ctx ? spacing : 0;

  const widths = lines.map((l) => lineWidth(ctx, l, spacingApplied));
  const blockW = Math.max(...widths);

  // Alto del bloque con el modelo de caja de CSS: cada línea ocupa `lineH` y el
  // sobrante se reparte arriba y abajo (half-leading). Es lo que hace que
  // "interlineado 120%" signifique lo mismo acá que en Figma.
  const lineH = (size * (text.lineHeight || 100)) / 100;
  const blockH = lineH * lines.length;
  const { ascent, descent } = fontMetrics(ctx, size);
  const halfLeading = (lineH - (ascent + descent)) / 2;

  const margin = Math.min(stage.w, stage.h) * TEXT_MARGIN;
  const col = text.anchor[1];
  const row = text.anchor[0];

  let x =
    col === "l" ? margin : col === "r" ? stage.w - margin - blockW : (stage.w - blockW) / 2;
  let y =
    row === "t" ? margin : row === "b" ? stage.h - margin - blockH : (stage.h - blockH) / 2;

  x += (stage.w * (text.offsetX || 0)) / 100;
  y += (stage.h * (text.offsetY || 0)) / 100;

  return { lines, widths, x, y, w: blockW, h: blockH, lineH, halfLeading, ascent };
}

function drawOne(ctx, text, stage) {
  const box = layout(ctx, text, stage);
  if (!box) return;

  ctx.fillStyle = text.color || "#FFFFFF";
  ctx.globalAlpha = clamp01((text.opacity ?? 100) / 100);

  for (let i = 0; i < box.lines.length; i++) {
    const free = box.w - box.widths[i];
    const x =
      box.x + (text.align === "center" ? free / 2 : text.align === "right" ? free : 0);
    ctx.fillText(box.lines[i], x, box.y + i * box.lineH + box.halfLeading + box.ascent);
  }
}

// Canvas de medición, perezoso: este módulo lo importa `state/defaults.js` y esa
// cadena corre también en los tests de Node, donde no hay `document`.
let measureCtx = null;

// Caja del bloque en coordenadas lógicas del stage, o null si el texto está
// vacío. Es lo que se agarra al arrastrar sobre el stage.
export function textBounds(text, stage) {
  if (typeof document === "undefined") return null;
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return layout(measureCtx, text, stage);
}

export function hasTexts(texts, slot) {
  return (
    Array.isArray(texts) &&
    texts.some((t) => t.visible !== false && (t.slot ?? "front") === slot)
  );
}

// Dibuja las capas de una ranura, en el orden de la lista (la última arriba).
export function drawTexts(ctx, texts, stage, slot) {
  if (!Array.isArray(texts) || !texts.length) return;

  let saved = false;
  for (const text of texts) {
    if (text.visible === false) continue;
    if ((text.slot ?? "front") !== slot) continue;
    if (!saved) {
      ctx.save();
      saved = true;
    }
    drawOne(ctx, text, stage);
  }
  // El `letterSpacing` es estado del contexto y sobrevive al frame: si no se
  // restaura, la siguiente cosa que dibuje la tool sale con el tracking del
  // último texto.
  if (saved) ctx.restore();
}
