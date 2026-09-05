import { useEffect, useMemo, useRef, useState } from "react";
import { TextStageOverlay } from "@bong/ui";
import { createRenderer } from "../render/renderer.js";
import { stageDims, stageOf, RATIOS } from "../engine/camera.js";
import { makeEase } from "../engine/ease.js";
import { loopClosure } from "../engine/loopTest.js";
import { lerp } from "../utils/math.js";

// Márgenes de Instagram, en fracción del stage. Sólo guía visual: son divs
// sobre el canvas, nunca entran al render y por lo tanto nunca se exportan.
const SAFE = {
  "9:16": { top: 0.13, bottom: 0.22, side: 0.055 }, // stories: header y CTA
  default: { top: 0.06, bottom: 0.06, side: 0.06 },
};

const dimsRefInit = (state) => stageOf(state);

export default function Stage({
  state,
  clock,
  engineRef,
  onTexts,
  selectedText,
  onSelectText,
}) {
  const areaRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const stateRef = useRef(state);
  const availRef = useRef({ w: 0, h: 0 });
  const dimsRef = useRef(stageOf(state));
  const stitchRef = useRef(null);
  const prevKeyRef = useRef(null);
  const prevDimsRef = useRef(dimsRefInit(state));
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  stateRef.current = state;

  // Self-test del loop: se recalcula sólo cuando cambia la config.
  const closure = useMemo(() => loopClosure(state), [state]);
  const dims = stageOf(state);

  // Dispara la animación de stitch al cambiar de ratio. Como el layout de los
  // templates es relativo al stage, los planos se reacomodan solos.
  useEffect(() => {
    const next = stageOf(state);
    const key = `${state.stage.ratio}:${state.stage.customW}x${state.stage.customH}`;

    if (prevKeyRef.current === null) {
      // Primer render: no hay de dónde venir, no hay stitch.
      dimsRef.current = next;
    } else if (prevKeyRef.current !== key) {
      if (state.stitch?.enabled) {
        stitchRef.current = {
          from: prevDimsRef.current,
          to: next,
          start: performance.now(),
          dur: (state.stitch.duration ?? 0.6) * 1000,
          ease: makeEase(state.stitch.ease),
        };
      } else {
        stitchRef.current = null;
        dimsRef.current = next;
      }
    }
    prevKeyRef.current = key;
    prevDimsRef.current = next;
  }, [state.stage.ratio, state.stage.customW, state.stage.customH, state.stitch]);

  // Medición del área disponible.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      availRef.current = { w: r.width, h: r.height };
    });
    ro.observe(el);
    availRef.current = { w: el.clientWidth, h: el.clientHeight };
    return () => ro.disconnect();
  }, []);

  // Bucle de dibujo: suscrito al reloj, corre cada frame (también en pausa, así
  // los cambios del sidebar se ven en vivo sin cablear nada).
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = createRenderer(canvas);
    rendererRef.current = engine;

    const fitToArea = (d) => {
      const avail = availRef.current;
      const scale = Math.min(
        (avail.w || d.w) / d.w,
        (avail.h || d.h) / d.h,
      );
      canvas.style.width = `${d.w * scale}px`;
      canvas.style.height = `${d.h * scale}px`;
    };

    const draw = () => {
      // Durante el export el canvas es del exporter: el preview no lo toca.
      if (busyRef.current) return;

      let d;
      const stitch = stitchRef.current;
      if (stitch) {
        const p = Math.min(1, (performance.now() - stitch.start) / stitch.dur);
        const e = stitch.ease(p);
        d = {
          w: lerp(stitch.from.w, stitch.to.w, e),
          h: lerp(stitch.from.h, stitch.to.h, e),
        };
        if (p >= 1) {
          dimsRef.current = stitch.to;
          stitchRef.current = null;
        }
      } else {
        d = dimsRef.current;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      engine.setSize(d.w, d.h, dpr);
      fitToArea(d);
      engine.draw(clock.getT(), stateRef.current, { stage: d });
    };

    // Handle que usa el panel de Export: mismo renderer, mismo canvas, misma
    // función de dibujo (BRIEF §2.2).
    engineRef.current = {
      canvas,
      configure(stage, pixelRatio) {
        engine.setSize(stage.w, stage.h, pixelRatio);
      },
      drawFrame(t01, stage) {
        engine.draw(t01, stateRef.current, { stage });
      },
      begin() {
        busyRef.current = true;
        setBusy(true);
      },
      end() {
        busyRef.current = false;
        setBusy(false);
        draw();
      },
    };

    const unsub = clock.subscribe(draw);
    draw();
    return () => {
      unsub();
      engineRef.current = null;
      engine.dispose();
    };
  }, [clock, engineRef]);

  const safe = SAFE[state.stage.ratio] ?? SAFE.default;
  const others = RATIOS.filter((r) => r.value !== state.stage.ratio);

  return (
    <div className="stage-area" ref={areaRef}>
      <div className="stage-wrap">
        <canvas ref={canvasRef} className="stage-canvas" />

        <div className="stage-overlays">
          {state.stage.safeFrames &&
            others.map((r) => (
              <div
                key={r.value}
                className="safe-frame"
                style={{
                  width: `${(r.w / dims.w) * 100}%`,
                  height: `${(r.h / dims.h) * 100}%`,
                }}
              >
                <span>{r.label}</span>
              </div>
            ))}
          {state.stage.safeArea && (
            <div
              className="safe-area"
              style={{
                top: `${safe.top * 100}%`,
                bottom: `${safe.bottom * 100}%`,
                left: `${safe.side * 100}%`,
                right: `${safe.side * 100}%`,
              }}
            />
          )}
        </div>

        <TextStageOverlay
          texts={state.texts}
          stage={dims}
          onChange={(next) =>
            onTexts?.(state.texts.map((t) => (t.id === next.id ? next : t)))
          }
          selectedId={selectedText}
          onSelect={onSelectText}
        />

        {busy && <div className="stage-recording">Exportando…</div>}

        <div className="stage-badge">
          <span>
            loop{" "}
            {closure.status === "ok" && <span className="ok">✓ cierra</span>}
            {closure.status === "cycles" && (
              <span className="warn-soft">✓ (× {closure.suggested} ciclos)</span>
            )}
            {closure.status === "over" && (
              <span className="warn">✗ pide {closure.minCycles} ciclos</span>
            )}
            {closure.status === "broken" && (
              <span className="warn">✗ Δ{(closure.maxDelta * 100).toFixed(1)}%</span>
            )}
          </span>
          <span>·</span>
          <span>
            {Math.round(dims.w)}×{Math.round(dims.h)}
          </span>
          <span>·</span>
          <span>
            {state.timing.cycles > 1
              ? `${state.timing.duration}s × ${state.timing.cycles}`
              : `${state.timing.duration}s`}
          </span>
        </div>
      </div>
    </div>
  );
}
