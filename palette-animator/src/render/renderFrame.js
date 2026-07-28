// Renderer canvas 2D. EL MISMO para preview y export (garantiza WYSIWYG).
// Dibuja en coordenadas lógicas del stage; el caller fija el transform (dpr o
// multiplicador de resolución) antes de llamar.

import { contrastColor } from "../utils/color.js";
import { clamp } from "../utils/math.js";

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function labelText(card, content) {
  const name = card.name?.trim();
  const hex = card.hex;
  if (content === "hex") return [hex];
  if (content === "name") return [name || hex];
  // both: si no hay nombre, solo el hex.
  return name ? [name, hex] : [hex];
}

function drawLabel(ctx, card, labels, alpha) {
  const lines = labelText(card, labels.content);
  const color = labels.autoContrast
    ? contrastColor(card.hex)
    : labels.color ?? "#FFFFFF";

  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2;
  const vertical =
    labels.verticalRotate && card.h > card.w * (labels.verticalFactor ?? 1.35);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(cx, cy);
  if (vertical) ctx.rotate(-Math.PI / 2);

  const size = labels.size;
  const gap = size * 0.28;
  // Familia elegida (sistema o Satoshi) con fallback, y peso configurable.
  const family = `"${labels.fontFamily || "Satoshi"}", ui-sans-serif, system-ui, sans-serif`;
  const weight = labels.fontWeight || 700;
  if (lines.length === 1) {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillText(lines[0], 0, 0);
  } else {
    const subSize = size * 0.72;
    const totalH = size + gap + subSize;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillText(lines[0], 0, -totalH / 2 + size / 2);
    ctx.font = `400 ${subSize}px ${family}`;
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillText(lines[1], 0, totalH / 2 - subSize / 2);
  }
  ctx.restore();
}

// frame: salida de getFrame. stage: {w,h}. state: config completa.
export function renderFrame(ctx, frame, stage, state) {
  ctx.save();
  ctx.fillStyle = state.stage?.background ?? "#0A0A0A";
  ctx.fillRect(0, 0, stage.w, stage.h);

  const bleed = state.containers?.mode === "bleed";
  const radius = bleed ? 0 : state.containers?.radius ?? 0;
  const labels = state.labels ?? { show: "never" };

  // Prominencia para el modo 'active' y para el hook de opacidad del label.
  let maxArea = 0;
  for (const c of frame) maxArea = Math.max(maxArea, c.w * c.h);
  maxArea = maxArea || 1;

  for (const card of frame) {
    if (card.opacity <= 0.001 || card.w <= 0.5 || card.h <= 0.5) continue;

    const cx = card.x + card.w / 2;
    const cy = card.y + card.h / 2;
    const rot = (card.rotate * Math.PI) / 180;

    ctx.save();
    ctx.globalAlpha = card.opacity;
    ctx.fillStyle = card.hex;
    if (rot !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      roundRectPath(ctx, -card.w / 2, -card.h / 2, card.w, card.h, radius);
    } else {
      roundRectPath(ctx, card.x, card.y, card.w, card.h, radius);
    }
    ctx.fill();
    ctx.restore();

    // Labels
    if (labels.show === "never") continue;
    const prominence = card.opacity * ((card.w * card.h) / maxArea);
    const isActive = prominence > 0.55;
    if (labels.show === "active" && !isActive) continue;

    let alpha = card.opacity;
    if (labels.opacityHook === "prominence") alpha = clamp(prominence * 1.4);
    else if (labels.opacityHook === "scale")
      alpha = clamp((card.w * card.h) / maxArea);
    if (alpha <= 0.02) continue;

    // El label rota junto a la card si está rotada.
    if (rot !== 0) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      const centered = { ...card, x: -card.w / 2, y: -card.h / 2 };
      drawLabel(ctx, centered, labels, alpha);
      ctx.restore();
    } else {
      drawLabel(ctx, card, labels, alpha);
    }
  }

  ctx.restore();
}
