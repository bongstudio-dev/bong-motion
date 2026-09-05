// Qué va a salir, antes de que salga.
//
// Es lo único que el modal agrega al motor: el resto de los números —las
// dimensiones por ratio, los ciclos que cierran, la duración— ya los calculaba
// alguien. Lo que no existía era juntarlos y decirlos ANTES de apretar.
//
// El peso no es una estimación de otro lado: usa la misma cuenta que el
// encoder, `ancho × alto × fps × calidad`, que es literalmente el bitrate que
// encodeWebCodecs le pide al VideoEncoder. Por eso vale para webm y mp4 y no
// para gif ni png, que no van por bitrate.

import { stageDims } from "../engine/camera.js";

export const VIDEO_KINDS = new Set(["webm", "mp4"]);

// Ratios efectivos del export: los tildados, o el del canvas si no hay ninguno.
export function exportRatios(state) {
  const list = state.export?.ratios ?? [];
  return list.length ? list : [state.stage.ratio];
}

export function ratioDims(state, ratio) {
  const d = stageDims(ratio, { w: state.stage.customW, h: state.stage.customH });
  const res = state.export?.resolution ?? 1;
  return { w: d.w * res, h: d.h * res };
}

export function exportSummary(state, kind = state.export?.format ?? "webm") {
  const ratios = exportRatios(state);
  const fps = state.stage.fps;
  const unFrame = kind === "png";

  const seconds = unFrame ? 0 : state.timing.duration * state.timing.cycles;
  const frames = unFrame ? 1 : Math.max(1, Math.round(fps * seconds));

  const archivos = ratios.map((ratio) => {
    const { w, h } = ratioDims(state, ratio);
    // bits/s × segundos / 8 = bytes. La calidad es bits por pixel por frame.
    const bytes = VIDEO_KINDS.has(kind)
      ? Math.round((w * h * fps * (state.export?.quality ?? 0.14) * seconds) / 8)
      : null;
    return { ratio, w, h, bytes };
  });

  const conocidos = archivos.every((a) => a.bytes != null);

  return {
    kind,
    files: archivos.length,
    seconds,
    frames,
    perFile: archivos,
    // null = no se puede saber (gif y png no van por bitrate). No es 0.
    bytes: conocidos ? archivos.reduce((a, f) => a + f.bytes, 0) : null,
  };
}

// "5.4 MB" / "820 kB". Nunca decimales de más: a esta escala no informan.
export function formatBytes(bytes) {
  if (bytes == null) return "peso variable";
  const mb = bytes / 1e6;
  if (mb < 1) return `${Math.round(bytes / 1e3)} kB`;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

// La línea que el modal muestra en el pie: cuántos archivos, cuánto duran y
// cuánto pesan. En ese orden porque es el orden en que preocupan.
export function summaryLine(s) {
  const partes = [`${s.files} ${s.files === 1 ? "archivo" : "archivos"}`];
  if (s.kind === "png") partes.push("1 frame");
  else partes.push(`${s.seconds.toFixed(1)}s`);
  partes.push(formatBytes(s.bytes));
  return partes.join(" · ");
}
