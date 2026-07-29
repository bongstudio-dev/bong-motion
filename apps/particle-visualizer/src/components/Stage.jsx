import { useRef, useState } from "react";
import { ASPECT_RATIOS, resolveAspect } from "../aspectRatios";
import { useStageScale } from "../hooks/useStageScale";
import ParticleCanvas from "./ParticleCanvas";

function pad(value) {
  return String(value).padStart(2, "0");
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function Stage({
  items,
  config,
  canvasRef,
  recorder,
  onConfigChange,
  onDropFiles,
}) {
  const aspect = resolveAspect(config.aspect);
  const dims = ASPECT_RATIOS[aspect];
  const { containerRef, scale, width, height } = useStageScale(
    dims.width,
    dims.height,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [draggingEmitter, setDraggingEmitter] = useState(false);
  const emitterSurfaceRef = useRef(null);

  const updateEmitterFromEvent = (event) => {
    const surface = emitterSurfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    onConfigChange?.("emitterX", Math.round(x * 100) / 100);
    onConfigChange?.("emitterY", Math.round(y * 100) / 100);
  };

  const handleEmitterPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingEmitter(true);
    updateEmitterFromEvent(event);
  };

  const handleEmitterPointerMove = (event) => {
    if (!draggingEmitter) return;
    updateEmitterFromEvent(event);
  };

  const handleEmitterPointerUp = (event) => {
    setDraggingEmitter(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // el pointer ya se soltó
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) {
      onDropFiles?.(event.dataTransfer.files);
    }
  };
  const clock = recorder
    ? `${pad(Math.floor(recorder.seconds / 60))}:${pad(recorder.seconds % 60)}`
    : "00:00";

  return (
    <section className="rounded-[32px] border border-stroke bg-panel/70 p-5 shadow-glow backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
            Stage
          </h2>
          <p className="mt-2 text-sm text-muted">
            Canvas {width}×{height}, escalado por CSS para entrar en viewport.
          </p>
        </div>
        <div className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-muted">
          Scale {scale.toFixed(2)}x
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.keys(ASPECT_RATIOS).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onConfigChange?.("aspect", key)}
            aria-pressed={aspect === key}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs transition ${
              aspect === key
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-white/10 bg-white/[0.03] text-muted hover:border-white/25 hover:text-white"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        onDragEnter={() => setIsDragging(true)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) {
            return;
          }
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`stage-grid relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[28px] border p-4 transition md:p-6 ${
          isDragging ? "border-accent" : "border-white/10"
        }`}
        style={{ backgroundColor: "rgba(255, 243, 228, 0.12)" }}
      >
        {isDragging ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-accent bg-app/70 backdrop-blur-sm">
            <span className="font-mono text-xl text-accent">+</span>
            <p className="text-lg font-medium text-white">
              Soltá las imágenes acá
            </p>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
              JPG · PNG · WEBP
            </p>
          </div>
        ) : null}

        {recorder && recorder.supported ? (
          <button
            type="button"
            onClick={recorder.isRecording ? recorder.stop : recorder.start}
            className={`absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur transition ${
              recorder.isRecording
                ? "border border-red-400/40 bg-red-500/80 text-white hover:bg-red-500"
                : "border border-black/10 bg-accent text-app hover:bg-[#3ce09b]"
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                recorder.isRecording ? "animate-pulse bg-white" : "bg-app/70"
              }`}
            />
            {recorder.isRecording
              ? `Detener · ${clock}`
              : `Grabar ${recorder.format}`}
          </button>
        ) : null}

        <div
          className="relative origin-center overflow-hidden rounded-[28px] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
          style={{
            backgroundColor: config.backgroundColor,
            width: `${width * scale}px`,
            height: `${height * scale}px`,
          }}
        >
          <ParticleCanvas
            width={width}
            height={height}
            scale={scale}
            items={items}
            config={config}
            canvasRef={canvasRef}
          />

          {/* Superficie de arrastre + handle del emitter. Es DOM (no canvas),
              así que se ve en pantalla pero NO aparece en la grabación. */}
          <div
            ref={emitterSurfaceRef}
            onPointerDown={handleEmitterPointerDown}
            onPointerMove={handleEmitterPointerMove}
            onPointerUp={handleEmitterPointerUp}
            className={`absolute inset-0 z-[5] ${
              draggingEmitter ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${clamp01(config.emitterX) * 100}%`,
                top: `${clamp01(config.emitterY) * 100}%`,
              }}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-accent bg-accent/20 shadow-[0_0_0_2px_rgba(0,0,0,0.45)] transition-transform ${
                  draggingEmitter ? "scale-125" : ""
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              </div>
              <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-app/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-accent backdrop-blur">
                Emitter
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Stage;
