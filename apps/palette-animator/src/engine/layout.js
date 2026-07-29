// Layout engine. Cada modo devuelve rects en píxeles lógicos del stage.
// El stage lógico siempre tiene 1080 en su lado menor.
//
// Regla dura: las cards nunca se salen del stage ni suman más del 100%.
// Los tracks animan `weight`, no anchos absolutos, para que esto se cumpla solo.

export const RATIOS = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
};

export const MIN_SIDE = 1080;

export const stageDims = (ratio) => RATIOS[ratio] ?? RATIOS["1:1"];

// Caja interior tras aplicar padding (fracción del lado menor).
export function innerBox(stage, padding) {
  const pad = padding * MIN_SIDE;
  return {
    x: pad,
    y: pad,
    w: Math.max(0, stage.w - pad * 2),
    h: Math.max(0, stage.h - pad * 2),
  };
}

// N columnas, ancho proporcional al peso. Alto completo.
function layoutRow(weights, inner, gapPx) {
  const N = weights.length;
  const totalGap = gapPx * Math.max(0, N - 1);
  const avail = Math.max(0, inner.w - totalGap);
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const rects = [];
  let cursor = inner.x;
  for (let i = 0; i < N; i++) {
    const w = (avail * Math.max(0, weights[i])) / sum;
    rects.push({ x: cursor, y: inner.y, w, h: inner.h });
    cursor += w + gapPx;
  }
  return rects;
}

// N filas, alto proporcional al peso. Ancho completo.
function layoutColumn(weights, inner, gapPx) {
  const N = weights.length;
  const totalGap = gapPx * Math.max(0, N - 1);
  const avail = Math.max(0, inner.h - totalGap);
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const rects = [];
  let cursor = inner.y;
  for (let i = 0; i < N; i++) {
    const h = (avail * Math.max(0, weights[i])) / sum;
    rects.push({ x: inner.x, y: cursor, w: inner.w, h });
    cursor += h + gapPx;
  }
  return rects;
}

// Columnas calculadas según el ratio del stage.
export function gridDivisions(N, stage) {
  if (N <= 1) return { cols: 1, rows: 1 };
  const aspect = stage.w / stage.h;
  // Filas ∝ 1/aspect: en landscape pocas filas (filas cortas),
  // en portrait más filas.
  let rows = Math.max(1, Math.min(N, Math.round(Math.sqrt(N / aspect))));
  let cols = Math.ceil(N / rows);
  // 9:16 y más estrechos priorizan 2 columnas.
  if (aspect <= 0.62) {
    cols = Math.min(2, N);
  }
  rows = Math.ceil(N / cols);
  return { cols, rows };
}

// Grilla uniforme. Con N impar, la última card ocupa el espacio sobrante
// de su fila. Ignora `weight` (celdas uniformes).
function layoutGrid(N, inner, gapPx, stage) {
  const { cols, rows } = gridDivisions(N, stage);
  const cellW = (inner.w - gapPx * (cols - 1)) / cols;
  const cellH = (inner.h - gapPx * (rows - 1)) / rows;
  const rects = [];
  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    rects.push({
      x: inner.x + col * (cellW + gapPx),
      y: inner.y + row * (cellH + gapPx),
      w: cellW,
      h: cellH,
    });
  }
  // La última card de la última fila incompleta rellena lo que sobra.
  const cardsInLastRow = N - cols * (rows - 1);
  if (cardsInLastRow > 0 && cardsInLastRow < cols) {
    const last = rects[N - 1];
    const extraSlots = cols - cardsInLastRow;
    last.w += extraSlots * (cellW + gapPx);
  }
  return rects;
}

// Todas centradas y superpuestas, con offset progresivo y escala decreciente.
// Base para el preset Stack (que luego interpola hacia grid vía `collapse`).
function layoutStack(N, inner, stage) {
  const side = Math.min(inner.w, inner.h) * 0.62;
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  const rects = [];
  for (let i = 0; i < N; i++) {
    rects.push({ x: cx - side / 2, y: cy - side / 2, w: side, h: side });
  }
  return rects;
}

// API pública. Devuelve [{x,y,w,h}] en píxeles lógicos del stage.
export function layout(weights, mode, stage, opts = {}) {
  const N = weights.length;
  if (N === 0) return [];
  const inner = innerBox(stage, opts.padding ?? 0);
  const gapPx = (opts.gap ?? 0) * MIN_SIDE;
  switch (mode) {
    case "column":
      return layoutColumn(weights, inner, gapPx);
    case "grid":
      return layoutGrid(N, inner, gapPx, stage);
    case "stack":
      return layoutStack(N, inner, stage);
    case "row":
    default:
      return layoutRow(weights, inner, gapPx);
  }
}

export const LAYOUT_MODES = ["row", "column", "grid", "stack"];
