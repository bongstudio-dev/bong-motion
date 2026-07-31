import { useRef, useState } from "react";
import { TextStageOverlay } from "@bong/ui";
import { ASPECT_RATIOS, resolveAspect } from "../aspectRatios";
import { useStageScale } from "../hooks/useStageScale";
import ParticleCanvas from "./ParticleCanvas";

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export default function Stage({
  items,
  config,
  canvasRef,
  onConfigChange,
  onDropFiles,
  tracker,
  selectedText,
  onSelectText,
}) {
  const aspect = resolveAspect(config.aspect);
  const dims = ASPECT_RATIOS[aspect];
  const { containerRef, scale, width, height } = useStageScale(dims.width, dims.height);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingEmitter, setDraggingEmitter] = useState(false);
  const surfaceRef = useRef(null);
  const handleRef = useRef(null);

  // Con la mano al mando, el rAF es dueño único de la posición del handle.
  const tracking = !!config.handTracking;

  const updateEmitter = (event) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    onConfigChange?.("emitterX", Math.round(clamp01((event.clientX - rect.left) / rect.width) * 100) / 100);
    onConfigChange?.("emitterY", Math.round(clamp01((event.clientY - rect.top) / rect.height) * 100) / 100);
  };

  return (
    <div
      className="stage-area"
      ref={containerRef}
      onDragEnter={() => setIsDragging(true)}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) onDropFiles?.(e.dataTransfer.files);
      }}
    >
      <div className="stage-wrap">
        <div
          style={{
            position: "relative",
            width: `${width * scale}px`,
            height: `${height * scale}px`,
            background: config.backgroundColor,
            overflow: "hidden",
          }}
        >
          <ParticleCanvas
            width={width}
            height={height}
            items={items}
            config={config}
            canvasRef={canvasRef}
            tracker={tracker}
            handleRef={handleRef}
          />

          {/* Va por encima de la superficie del emisor: si el emisor se la
              comiera, no habría forma de agarrar un texto. Sólo capturan los
              recuadros de los textos, el resto del área sigue siendo del
              emisor. */}
          <TextStageOverlay
            texts={config.texts}
            stage={{ w: width, h: height }}
            onChange={(next) =>
              onConfigChange(
                "texts",
                config.texts.map((t) => (t.id === next.id ? next : t)),
              )
            }
            selectedId={selectedText}
            onSelect={onSelectText}
          />

          {/* Superficie de arrastre + handle del emitter. Es DOM, no canvas:
              se ve en pantalla pero NO entra en la grabación. */}
          <div
            ref={surfaceRef}
            className="emitter-surface"
            data-dragging={draggingEmitter || undefined}
            // Con tracking activo el drag no puede ganarle a la mano: dejarlo
            // vivo dispararía dos setConfig por movimiento sin mover nada, que
            // es exactamente lo que se siente como "roto".
            style={tracking ? { pointerEvents: "none" } : undefined}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDraggingEmitter(true);
              updateEmitter(e);
            }}
            onPointerMove={(e) => draggingEmitter && updateEmitter(e)}
            onPointerUp={(e) => {
              setDraggingEmitter(false);
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* ya se soltó */
              }
            }}
            onPointerCancel={() => setDraggingEmitter(false)}
          >
            <div
              ref={handleRef}
              className="emitter-handle"
              data-dragging={draggingEmitter || undefined}
              data-tracked={tracking || undefined}
              // Con tracking, el style lo escribe el rAF: si React siguiera
              // rindiendo left/top se los pisaría en cada render.
              style={
                tracking
                  ? undefined
                  : {
                      left: `${clamp01(config.emitterX) * 100}%`,
                      top: `${clamp01(config.emitterY) * 100}%`,
                    }
              }
            >
              <span />
            </div>
          </div>
        </div>

        {isDragging && (
          <div className="stage-drop">
            <Plus />
            <p>Soltá las imágenes acá</p>
            <small>JPG · PNG · WEBP</small>
          </div>
        )}

        <div className="stage-badge">
          <span>
            {width}×{height}
          </span>
          <span>·</span>
          <span>escala {scale.toFixed(2)}×</span>
          <span>·</span>
          <span>
            {items.length} sprite{items.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}

const Plus = () => (
  <svg width="18" height="18" viewBox="0 0 13 13">
    <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
