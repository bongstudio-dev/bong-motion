// Export. Todo sale del MISMO getFrame(t). Durante la grabación el canvas se
// renderiza en modo determinístico: se avanza t POR FRAME, no por reloj. Es la
// única forma de que el archivo no dependa del rendimiento de la máquina.

import { getFrame } from "../engine/getFrame.js";
import { renderFrame } from "../render/renderFrame.js";
import { stageDims } from "../engine/layout.js";
import { triggerDownload } from "../state/storage.js";

function makeCanvas(stage, resolution) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(stage.w * resolution);
  canvas.height = Math.round(stage.h * resolution);
  return canvas;
}

// Dibuja el frame en t01 a la resolución pedida (multiplicador sobre el lógico).
function drawAt(ctx, resolution, state, stage, t01) {
  ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
  const frame = getFrame(t01, state, { stageOverride: stage });
  renderFrame(ctx, frame, stage, state);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Espera a que Satoshi esté disponible antes de rasterizar labels.
async function ensureFont() {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* noop */
    }
  }
}

function pickVideoMime(container) {
  const candidates =
    container === "mp4"
      ? ["video/mp4;codecs=avc1.640028", "video/mp4", "video/webm;codecs=vp9", "video/webm"]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "video/webm";
}

// WebM / MP4 vía captureStream(0) + requestFrame() → frames manuales.
export async function exportVideo(state, opts = {}) {
  const {
    fps = 30,
    cycles = 1,
    resolution = 1,
    container = "webm",
    onProgress,
  } = opts;

  await ensureFont();
  const stage = stageDims(state.stage.ratio);
  const canvas = makeCanvas(stage, resolution);
  const ctx = canvas.getContext("2d");

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const requestFrame = () => {
    if (track && typeof track.requestFrame === "function") track.requestFrame();
    else if (typeof stream.requestFrame === "function") stream.requestFrame();
  };

  const mime = pickVideoMime(container);
  const usedContainer = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 12_000_000,
  });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => (rec.onstop = res));

  rec.start();
  const framesPerCycle = Math.max(1, Math.round(fps * state.motion.duration));
  const totalFrames = framesPerCycle * Math.max(1, Math.round(cycles));
  const frameInterval = 1000 / fps;

  for (let f = 0; f < totalFrames; f++) {
    const t01 = (f % framesPerCycle) / framesPerCycle;
    drawAt(ctx, resolution, state, stage, t01);
    requestFrame();
    onProgress?.((f + 1) / totalFrames);
    await delay(frameInterval);
  }
  // Un frame final para cerrar el stream limpio.
  requestFrame();
  await delay(frameInterval);
  rec.stop();
  await stopped;

  const type = usedContainer === "mp4" ? "video/mp4" : "video/webm";
  const blob = new Blob(chunks, { type });
  return { blob, container: usedContainer, requestedContainer: container };
}

// GIF vía gif.js. Import dinámico para aislar fallos del worker.
export async function exportGIF(state, opts = {}) {
  const { fps = 30, cycles = 1, resolution = 1, quality = 10, onProgress } = opts;
  await ensureFont();

  const [{ default: GIF }, workerMod] = await Promise.all([
    import("gif.js"),
    import("gif.js/dist/gif.worker.js?url"),
  ]);
  const workerScript = workerMod.default;

  const stage = stageDims(state.stage.ratio);
  const canvas = makeCanvas(stage, resolution);
  const ctx = canvas.getContext("2d");

  const gif = new GIF({
    workers: 2,
    quality,
    workerScript,
    width: canvas.width,
    height: canvas.height,
    dither: false,
  });

  const framesPerCycle = Math.max(1, Math.round(fps * state.motion.duration));
  const totalFrames = framesPerCycle * Math.max(1, Math.round(cycles));
  const frameDelayMs = Math.round(1000 / fps);

  for (let f = 0; f < totalFrames; f++) {
    const t01 = (f % framesPerCycle) / framesPerCycle;
    drawAt(ctx, resolution, state, stage, t01);
    gif.addFrame(ctx, { copy: true, delay: frameDelayMs });
    onProgress?.(((f + 1) / totalFrames) * 0.5);
  }

  return new Promise((resolve, reject) => {
    gif.on("progress", (p) => onProgress?.(0.5 + p * 0.5));
    gif.on("finished", (blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF export abortado")));
    gif.render();
  });
}

// PNG del frame actual — para thumbnails y placeholders.
export function exportPNG(state, t01, resolution = 2) {
  const stage = stageDims(state.stage.ratio);
  const canvas = makeCanvas(stage, resolution);
  const ctx = canvas.getContext("2d");
  drawAt(ctx, resolution, state, stage, t01);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, `palette-${Date.now()}.png`);
      resolve(blob);
    }, "image/png");
  });
}

export function downloadBlob(blob, filename) {
  triggerDownload(blob, filename);
}
