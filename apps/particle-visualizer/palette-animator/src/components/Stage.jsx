import { useEffect, useMemo, useRef } from "react";
import { getFrame } from "../engine/getFrame.js";
import { renderFrame } from "../render/renderFrame.js";
import { stageDims } from "../engine/layout.js";
import { makeEase } from "../engine/ease.js";
import { loopClosure } from "../engine/loopTest.js";
import { lerp } from "../utils/math.js";

export default function Stage({ state, clock }) {
  const areaRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(state);
  const availRef = useRef({ w: 0, h: 0 });
  const dimsRef = useRef(stageDims(state.stage.ratio));
  const stitchRef = useRef(null);
  const prevRatioRef = useRef(state.stage.ratio);

  stateRef.current = state;

  // Self-test del loop: se recalcula solo cuando cambia la config.
  const closure = useMemo(() => loopClosure(state), [state]);

  // Dispara la animación de stitch al cambiar de ratio.
  useEffect(() => {
    const prev = prevRatioRef.current;
    const next = state.stage.ratio;
    if (prev !== next) {
      if (state.stitch?.enabled) {
        stitchRef.current = {
          from: stageDims(prev),
          to: stageDims(next),
          start: performance.now(),
          dur: (state.stitch.duration ?? 0.6) * 1000,
          ease: makeEase(state.stitch.ease),
        };
      } else {
        dimsRef.current = stageDims(next);
      }
      prevRatioRef.current = next;
    }
  }, [state.stage.ratio, state.stitch]);

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

  // Bucle de dibujo: suscrito al reloj, corre cada frame (también en pausa,
  // así los cambios del sidebar se ven en vivo sin cablear nada).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });

    const draw = () => {
      const st = stateRef.current;

      // Dims actuales (interpoladas si hay stitch en curso).
      let dims;
      const stitch = stitchRef.current;
      if (stitch) {
        const p = Math.min(1, (performance.now() - stitch.start) / stitch.dur);
        const e = stitch.ease(p);
        dims = {
          w: lerp(stitch.from.w, stitch.to.w, e),
          h: lerp(stitch.from.h, stitch.to.h, e),
        };
        if (p >= 1) {
          dimsRef.current = stitch.to;
          stitchRef.current = null;
        }
      } else {
        dims = dimsRef.current;
      }

      // Backing store a devicePixelRatio.
      const dpr = window.devicePixelRatio || 1;
      const bw = Math.round(dims.w * dpr);
      const bh = Math.round(dims.h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }

      // Escala visual para encajar en el área (transform: scale del viewport).
      const avail = availRef.current;
      const scale = Math.min(
        (avail.w || dims.w) / dims.w,
        (avail.h || dims.h) / dims.h,
      );
      canvas.style.width = `${dims.w * scale}px`;
      canvas.style.height = `${dims.h * scale}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const frame = getFrame(clock.getT(), st, { stageOverride: dims });
      renderFrame(ctx, frame, dims, st);
    };

    const unsub = clock.subscribe(draw);
    draw();
    return unsub;
  }, [clock]);

  const dims = stageDims(state.stage.ratio);

  return (
    <div className="stage-area" ref={areaRef}>
      <div className="stage-wrap">
        <canvas ref={canvasRef} className="stage-canvas" />
        <div className="stage-badge">
          <span>
            loop{" "}
            {closure.closes ? (
              <span className="ok">✓ cierra</span>
            ) : (
              <span className="warn">
                ⚠ Δ{(closure.maxPos * 100).toFixed(1)}%
              </span>
            )}
          </span>
          <span>·</span>
          <span>
            {dims.w}×{dims.h}
          </span>
        </div>
      </div>
    </div>
  );
}
