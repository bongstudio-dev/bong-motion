// Export. BRIEF §9.
//
// Todo sale del MISMO draw(t01) que dibuja el preview. Durante la grabación se
// avanza t POR FRAME, nunca por reloj: el archivo no puede depender del
// rendimiento de la máquina.
//
// Refactor respecto del palette-animator: el exporter recibe un callback
// `draw(t01)` y un canvas, y NO importa el engine. Así el mismo exporter sirve
// si mañana cambia el renderer — que es exactamente lo que pasó al saltar de
// Canvas 2D a WebGL.

import { triggerDownload } from "../state/storage.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Reloj de grabación. Los browsers clampean setTimeout a ~1s cuando la pestaña
// no está visible, y MediaRecorder timestampea los frames por reloj REAL: un
// export en background saldría a 1 fps, con la duración mal y sin ningún error.
// El timer de un worker no sufre ese clamp, así que el archivo deja de depender
// de si el usuario se fue a otra pestaña (invariante §3).
function createTicker() {
  let worker = null;
  let url = null;
  try {
    const src =
      "let id=null;onmessage=e=>{if(e.data.stop){clearTimeout(id);return;}" +
      "id=setTimeout(()=>postMessage(0),e.data.ms)};";
    url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    worker = new Worker(url);
  } catch {
    worker = null; // sin worker seguimos con setTimeout: peor, pero funciona
  }
  return {
    wait: (ms) =>
      new Promise((res) => {
        if (!worker) return void setTimeout(res, ms);
        worker.onmessage = () => res();
        worker.postMessage({ ms });
      }),
    dispose() {
      worker?.terminate();
      if (url) URL.revokeObjectURL(url);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Camino A — WebCodecs: el framerate sale EXACTO                      */
/* ------------------------------------------------------------------ */
//
// MediaRecorder timestampea cada frame con el reloj real, así que si dibujar
// un frame tarda más que 1/fps el archivo sale con menos fps de los pedidos y
// se ve a saltos. VideoEncoder deja poner el timestamp a mano: el frame f va
// SIEMPRE en f/fps, tarde lo que tarde el encoder. Es la única forma de cumplir
// el invariante §3 — el archivo no puede depender del rendimiento de la máquina.

const CODECS = {
  // Niveles altos primero: hay que soportar 2160×2700 a 60fps.
  mp4: [
    "avc1.640034", "avc1.640033", "avc1.64002a", "avc1.640028",
    "avc1.4d0034", "avc1.4d0033", "avc1.42e034", "avc1.42e01e",
  ],
  webm: ["vp09.00.51.08", "vp09.00.41.08", "vp09.00.10.08", "vp8"],
};

const muxerCodec = (codec) =>
  codec.startsWith("avc") ? "avc" : codec.startsWith("vp09") ? "V_VP9" : "V_VP8";

async function pickCodec(container, width, height, fps, bitrate) {
  for (const codec of CODECS[container] ?? CODECS.webm) {
    const config = {
      codec,
      width,
      height,
      framerate: fps,
      bitrate,
      ...(codec.startsWith("avc") ? { avc: { format: "avc" } } : {}),
    };
    try {
      const probe = await VideoEncoder.isConfigSupported(config);
      if (probe?.supported) return { codec, config };
    } catch {
      /* codec no reconocido: probamos el siguiente */
    }
  }
  return null;
}

// Espera a que la cola del encoder baje. De paso cede el hilo, así la barra de
// progreso se actualiza.
function drain(encoder, max) {
  if (encoder.encodeQueueSize <= max) return Promise.resolve();
  return new Promise((res) => {
    const onDequeue = () => {
      if (encoder.encodeQueueSize <= max) {
        encoder.removeEventListener("dequeue", onDequeue);
        res();
      }
    };
    encoder.addEventListener("dequeue", onDequeue);
  });
}

async function encodeWebCodecs({ canvas, draw, fps, totalFrames, container, quality, onProgress }) {
  const width = canvas.width;
  const height = canvas.height;
  // H.264 exige lados pares.
  if (container === "mp4" && (width % 2 || height % 2)) return null;

  const bitrate = Math.round(width * height * fps * quality);
  const picked = await pickCodec(container, width, height, fps, bitrate);
  if (!picked) return null;

  const [{ Muxer, ArrayBufferTarget }] =
    container === "mp4"
      ? [await import("mp4-muxer")]
      : [await import("webm-muxer")];

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: muxerCodec(picked.codec), width, height, frameRate: fps },
    ...(container === "mp4" ? { fastStart: "in-memory" } : {}),
  });

  let failure = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  encoder.configure(picked.config);

  const frameDur = 1e6 / fps; // microsegundos
  const gop = Math.max(1, Math.round(fps * 2));

  for (let f = 0; f < totalFrames; f++) {
    if (failure) break;
    draw(f / totalFrames);
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(f * frameDur),
      duration: Math.round(frameDur),
    });
    encoder.encode(frame, { keyFrame: f % gop === 0 });
    frame.close();
    onProgress?.((f + 1) / totalFrames);
    await drain(encoder, 6);
  }

  if (failure) {
    try { encoder.close(); } catch { /* ya cerrado */ }
    throw failure;
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  return {
    blob: new Blob([muxer.target.buffer], {
      type: container === "mp4" ? "video/mp4" : "video/webm",
    }),
    container,
    requestedContainer: container,
    drift: 1, // por construcción: los timestamps los ponemos nosotros
    codec: picked.codec,
    exact: true,
  };
}

/* ------------------------------------------------------------------ */
/* Camino B — MediaRecorder (fallback)                                 */
/* ------------------------------------------------------------------ */

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

// Entrada única. Intenta WebCodecs (framerate exacto) y cae a MediaRecorder
// sólo si el browser no lo soporta.
export async function exportVideo(opts) {
  const { container = "webm", quality = 0.14 } = opts;
  if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
    try {
      const out = await encodeWebCodecs({ ...opts, container, quality });
      if (out) return out;
    } catch (err) {
      console.warn("WebCodecs falló, se graba con MediaRecorder:", err);
    }
  }
  return recordMediaRecorder(opts);
}

// WebM / MP4 vía captureStream(0) + requestFrame() → frames manuales.
async function recordMediaRecorder({
  canvas,
  draw,
  fps = 30,
  totalFrames,
  container = "webm",
  onProgress,
}) {
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
    videoBitsPerSecond: 16_000_000,
  });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => (rec.onstop = res));

  const ticker = createTicker();
  const frameInterval = 1000 / fps;
  const started = performance.now();

  rec.start();
  try {
    for (let f = 0; f < totalFrames; f++) {
      draw(f / totalFrames);
      requestFrame();
      onProgress?.((f + 1) / totalFrames);
      await ticker.wait(frameInterval);
    }
    // Un frame final para cerrar el stream limpio.
    requestFrame();
    await ticker.wait(frameInterval);
  } finally {
    ticker.dispose();
  }
  rec.stop();
  await stopped;
  track?.stop();

  // Si aun así la grabación tardó mucho más de lo que dura la pieza, los
  // timestamps quedaron estirados y el archivo NO tiene la duración pedida.
  // Vale más decirlo que entregar un video mal en silencio.
  const expected = ((totalFrames + 1) / fps) * 1000;
  const drift = (performance.now() - started) / expected;

  const type = usedContainer === "mp4" ? "video/mp4" : "video/webm";
  return {
    blob: new Blob(chunks, { type }),
    container: usedContainer,
    requestedContainer: container,
    drift,
  };
}

// GIF vía gif.js. Import dinámico para aislar fallos del worker.
export async function exportGIF({
  canvas,
  draw,
  fps = 30,
  totalFrames,
  quality = 10,
  onProgress,
}) {
  const [{ default: GIF }, workerMod] = await Promise.all([
    import("gif.js"),
    import("gif.js/dist/gif.worker.js?url"),
  ]);

  const gif = new GIF({
    workers: 2,
    quality,
    workerScript: workerMod.default,
    width: canvas.width,
    height: canvas.height,
    dither: false,
  });

  // gif.js sólo sabe leer un contexto 2D; el canvas del renderer es WebGL, así
  // que cada frame se copia a un scratch 2D. Funciona porque el renderer se
  // crea con preserveDrawingBuffer.
  const scratch = document.createElement("canvas");
  scratch.width = canvas.width;
  scratch.height = canvas.height;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  const frameDelayMs = Math.round(1000 / fps);

  for (let f = 0; f < totalFrames; f++) {
    draw(f / totalFrames);
    ctx.clearRect(0, 0, scratch.width, scratch.height);
    ctx.drawImage(canvas, 0, 0);
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

// PNG del frame actual.
export function exportPNG({ canvas, draw, t01 }) {
  draw(t01);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function downloadBlob(blob, filename) {
  triggerDownload(blob, filename);
}
